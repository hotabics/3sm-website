import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifications";
import { deliverRegistrationUpdateNotifications } from "@/lib/notification-outbox";
import { formatRiga } from "@/lib/time";

export const runtime = "nodejs";

/**
 * Stripe webhook — apstrādā `checkout.session.completed` un atjaunina
 * `payments`. Maksājums parasti jau piesaistīts reģistrācijai (payForTraining);
 * ja nē — piesaista vai (vecām sesijām) izveido reģistrāciju.
 *
 * Drošība: pārbauda Stripe-Signature header pret `STRIPE_WEBHOOK_SECRET`.
 */
export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `invalid signature: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.payment_id;
      const userId = session.metadata?.user_id;
      const trainingId = session.metadata?.training_id;
      if (!paymentId || !userId || !trainingId) break;

      // Webhook drīkst pienākt atkārtoti. Maksājuma atzīmi atjaunojam tikai
      // vienreiz, bet zemāk vienmēr pārbaudām, vai reģistrācija patiešām ir.
      const { data: existingPayment } = await admin
        .from("payments")
        .select("id, status")
        .eq("id", paymentId)
        .maybeSingle();
      if (!existingPayment) {
        break;
      }
      if (existingPayment.status !== "pending" && existingPayment.status !== "paid") {
        break;
      }

      if (existingPayment.status === "pending") {
        const { error: paymentError } = await admin
          .from("payments")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ?? null,
          })
          .eq("id", paymentId)
          .eq("status", "pending"); // tikai no pending → paid (race-safe)
        if (paymentError) {
          console.error("[stripe webhook] could not mark payment paid", paymentError);
          return NextResponse.json({ error: "payment update failed" }, { status: 500 });
        }
      }

      // Reģistrē, ja vēl nav (training_id + user_id ir UNIQUE).
      const { data: existing } = await admin
        .from("registrations")
        .select("id, status, payment_id")
        .eq("training_id", trainingId)
        .eq("user_id", userId)
        .maybeSingle();

      let registrationCreated = false;
      let registrationId: string | null = null;
      if (!existing) {
        const { data: created, error: registrationError } = await admin
          .from("registrations")
          .insert({
            training_id: trainingId,
            user_id: userId,
            status: "queue",
            payment_id: paymentId,
          })
          .select("id")
          .single();
        if (registrationError || !created) {
          console.error("[stripe webhook] could not create registration", registrationError);
          return NextResponse.json({ error: "registration create failed" }, { status: 500 });
        }
        registrationId = created.id;
        registrationCreated = true;
      } else if (existing.status !== "cancelled") {
        // Parāda apmaksa jau esošam pieteikumam: piesaista maksājumu.
        if (existing.payment_id !== paymentId) {
          const { error: linkError } = await admin
            .from("registrations")
            .update({ payment_id: paymentId })
            .eq("id", existing.id);
          if (linkError) {
            console.error("[stripe webhook] could not link payment to registration", linkError);
            return NextResponse.json({ error: "registration update failed" }, { status: 500 });
          }
        }
      } else if (existing.status === "cancelled") {
        const { data: restored, error: registrationError } = await admin
          .from("registrations")
          .update({
            status: "queue",
            payment_id: paymentId,
            cancelled_at: null,
            registered_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id")
          .single();
        if (registrationError || !restored) {
          console.error("[stripe webhook] could not restore registration", registrationError);
          return NextResponse.json({ error: "registration restore failed" }, { status: 500 });
        }
        registrationId = restored.id;
        registrationCreated = true;
      }

      // Arī webhook retry pēc daļējas kļūmes izveido trūkstošo outbox notikumu.
      const shouldNotify =
        registrationId !== null ||
        (existing?.status !== "cancelled" && existing?.payment_id === paymentId);
      const notificationRegistrationId = registrationId ?? existing?.id ?? null;
      if (shouldNotify && notificationRegistrationId) {
        // Triggeris reģistrācijas INSERT/UPDATE laikā atomiski izveidoja
        // outbox notikumu. Webhook šeit tikai sāk tūlītēju piegādes mēģinājumu.
        await deliverRegistrationUpdateNotifications({ registrationId: notificationRegistrationId });
      }

      if (registrationCreated) {
        const [{ data: profile }, { data: tr }] = await Promise.all([
          admin.from("users").select("name, nickname").eq("id", userId).maybeSingle(),
          admin.from("trainings").select("date").eq("id", trainingId).maybeSingle(),
        ]);
        const displayName =
          profile?.nickname?.trim() || profile?.name?.trim() || "Spēlētājs";
        const dateLabel = tr?.date
          ? formatRiga(tr.date + "T20:00:00Z", "EEEE, d. MMMM")
          : "treniņam";
        await notifyAdmins(
          `🆕 3SM: ${displayName} pieteicās ${dateLabel} treniņam (rezervists, Stripe samaksāts).`,
          "admin_new_registration"
        );
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const intentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
      if (!intentId) break;
      await admin
        .from("payments")
        .update({ status: "refunded", refunded_at: new Date().toISOString() })
        .eq("stripe_payment_intent_id", intentId);
      break;
    }

    default:
      // Nezināms event tips — ignorējam.
      break;
  }

  return NextResponse.json({ received: true });
}
