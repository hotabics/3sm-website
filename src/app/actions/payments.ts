"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, SINGLE_TRAINING_PRICE_CENTS } from "@/lib/stripe";
import { formatRiga } from "@/lib/time";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result =
  | { ok: true; checkoutUrl?: string }
  | { ok: false; error: string };

/**
 * Samaksā par treniņu — neobligāti, jebkurā brīdī: uzreiz pēc pieteikšanās
 * vai vēlāk kā parādu. Vajag esošu (neatceltu) reģistrāciju.
 *
 * - Stripe: izveido `payments` (pending) + Checkout sesiju, atgriež URL;
 *   webhook atzīmē kā paid.
 * - Swedbank: izveido `payments` (pending), admins apstiprina, kad redz
 *   pārskaitījumu.
 * Abos gadījumos maksājums tiek piesaistīts reģistrācijai (`payment_id`).
 */
export async function payForTraining(
  trainingId: string,
  method: "stripe" | "manual_swedbank"
): Promise<Result> {
  if (typeof trainingId !== "string" || !UUID_RE.test(trainingId)) {
    return { ok: false, error: "Nederīgs treniņa ID." };
  }
  if (method !== "stripe" && method !== "manual_swedbank") {
    return { ok: false, error: "Nederīga maksāšanas metode." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nav pieslēgts." };

  const { data: training } = await supabase
    .from("trainings")
    .select("id, date, status")
    .eq("id", trainingId)
    .maybeSingle();

  if (!training) return { ok: false, error: "Treniņš nav atrasts." };
  if (training.status === "cancelled") {
    return { ok: false, error: "Treniņš atcelts — nav par ko maksāt." };
  }

  const { data: reg } = await supabase
    .from("registrations")
    .select("id, status, payment:payments!registrations_payment_fkey(id, status, provider)")
    .eq("training_id", trainingId)
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (!reg) {
    return { ok: false, error: "Vispirms piesakies uz treniņu." };
  }
  const current = (reg.payment ?? null) as unknown as
    | { id: string; status: string; provider: string }
    | null;
  if (current?.status === "paid") {
    return { ok: false, error: "Par šo treniņu jau samaksāts." };
  }
  if (current?.status === "pending" && current.provider === "manual_swedbank") {
    return { ok: false, error: "Pārskaitījums jau gaida apstiprinājumu." };
  }

  // Service role klients — maksājumu rindas un payment_id raksta tikai serveris.
  const admin = createAdminClient();

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      user_id: user.id,
      type: "single_training",
      amount_cents: SINGLE_TRAINING_PRICE_CENTS,
      currency: "eur",
      provider: method,
      status: "pending",
      training_id: trainingId,
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    return { ok: false, error: payErr?.message ?? "Neizdevās izveidot maksājumu." };
  }

  // Iepriekšējais nepabeigtais kartes maksājums vairs nav aktuāls.
  if (current?.status === "pending") {
    await admin.from("payments").update({ status: "failed" }).eq("id", current.id);
  }

  const { error: linkErr } = await admin
    .from("registrations")
    .update({ payment_id: payment.id })
    .eq("id", reg.id);
  if (linkErr) return { ok: false, error: linkErr.message };

  if (method === "manual_swedbank") {
    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/admin/payments");
    return { ok: true };
  }

  // Stripe Checkout — origin tikai no env (nedrīkst trustot Origin header,
  // kuru klients var iestatīt uz savu phishing-domēnu).
  const stripe = getStripe();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://3sm.lv";

  const dateLabel = formatRiga(training.date + "T20:00:00Z", "EEEE, d. MMMM");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: SINGLE_TRAINING_PRICE_CENTS,
          product_data: {
            name: `3SM treniņš — ${dateLabel}`,
            description: "Vienas spēles maksa.",
          },
        },
      },
    ],
    customer_email: user.email,
    metadata: {
      payment_id: payment.id,
      user_id: user.id,
      training_id: trainingId,
    },
    success_url: `${origin}/?paid=1`,
    cancel_url: `${origin}/?cancelled=1`,
  });

  if (!session.url) {
    return { ok: false, error: "Neizdevās izveidot maksāšanas saiti." };
  }

  // Saglabā session ID, lai webhook varētu sasaistīt.
  await admin
    .from("payments")
    .update({ stripe_session_id: session.id })
    .eq("id", payment.id);

  return { ok: true, checkoutUrl: session.url };
}
