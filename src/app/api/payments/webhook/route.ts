import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Stripe webhook — apstrādā `checkout.session.completed` un atjaunina
 * `payments` + izveido `registrations` rindu, ja vēl nav.
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

      // Atjaunot maksājuma statusu
      await admin
        .from("payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        })
        .eq("id", paymentId);

      // Reģistrēt, ja vēl nav
      const { data: existing } = await admin
        .from("registrations")
        .select("id, status")
        .eq("training_id", trainingId)
        .eq("user_id", userId)
        .neq("status", "cancelled")
        .maybeSingle();

      if (!existing) {
        await admin.from("registrations").insert({
          training_id: trainingId,
          user_id: userId,
          status: "queue",
          payment_id: paymentId,
        });
      } else if (!existing.status || existing.status === "cancelled") {
        await admin
          .from("registrations")
          .update({ status: "queue", payment_id: paymentId })
          .eq("id", existing.id);
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
