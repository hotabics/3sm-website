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
 * Sāk maksāšanas plūsmu rezervistam — vai nu Stripe Checkout, vai
 * manuāls Swedbank pārskaitījums. Reģistrācijas ieraksts tiek izveidots
 * uzreiz ar status='queue' un linked payment.
 *
 * - Stripe path: izveido `payments` rindu (pending), Checkout sesiju,
 *   atgriež URL. Reģistrācija tiek aktivizēta tikai pēc webhook'a.
 * - Swedbank path: izveido `payments` rindu (pending, manual_swedbank)
 *   un `registrations` rindu uzreiz, lai admin redz un var apstiprināt.
 */
export async function startReservePayment(
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
    .select("id, date, status, registration_closes_at")
    .eq("id", trainingId)
    .maybeSingle();

  if (!training) return { ok: false, error: "Treniņš nav atrasts." };
  if (training.status !== "open") {
    return { ok: false, error: "Reģistrācija slēgta." };
  }
  if (new Date(training.registration_closes_at) <= new Date()) {
    return { ok: false, error: "Reģistrācijas laiks beidzies." };
  }

  // Vai jau eksistē aktīva reģistrācija šim treniņam?
  const { data: existing } = await supabase
    .from("registrations")
    .select("id, status")
    .eq("training_id", trainingId)
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Tu jau esi pieteicies šim treniņam." };
  }

  // Service role klients — webhook un servera puses mutācijām.
  const admin = createAdminClient();

  // Maksājuma rinda (pending).
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

  if (method === "manual_swedbank") {
    // Reģistrē uzreiz, gaida admin manuālu apstiprinājumu.
    const { error: regErr } = await admin.from("registrations").insert({
      training_id: trainingId,
      user_id: user.id,
      status: "queue",
      payment_id: payment.id,
    });
    if (regErr) return { ok: false, error: regErr.message };
    revalidatePath("/");
    revalidatePath(`/training/${trainingId}`);
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
            description: "Vienas spēles maksa rezervistam.",
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
