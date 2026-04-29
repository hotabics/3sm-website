"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { defaultTrainingTimes } from "@/lib/trainings";
import { requireAdmin } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

export async function createTraining(formData: FormData): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "");
  const location = String(formData.get("location") ?? "Pilna info admin panelī");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Nederīgs datums." };
  }

  const times = defaultTrainingTimes(date);

  const { error } = await supabase.from("trainings").insert({
    date,
    location,
    status: "open",
    ...times,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings");
  revalidatePath("/");
  return { ok: true };
}

export async function approveRegistration(
  registrationId: string
): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({ status: "confirmed" })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function removeRegistration(
  registrationId: string
): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

/**
 * Drag-and-drop sadalītājs: piešķir vai noņem komandu reģistrācijai.
 */
export async function setTeam(
  registrationId: string,
  team: "black" | "white" | null
): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({ team })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function approveResult(resultId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nav pieslēgts." };

  const { data: result, error: fetchError } = await supabase
    .from("results")
    .select("training_id, status")
    .eq("id", resultId)
    .single();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (result.status === "approved")
    return { ok: false, error: "Jau apstiprināts." };

  const { error: updateError } = await supabase
    .from("results")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", resultId);
  if (updateError) return { ok: false, error: updateError.message };

  // Pēc rezultāta apstiprināšanas treniņš → completed (statistikas vajadzībām).
  await supabase
    .from("trainings")
    .update({ status: "completed" })
    .eq("id", result.training_id);

  revalidatePath("/admin/results");
  revalidatePath("/stats");
  revalidatePath(`/training/${result.training_id}`);
  return { ok: true };
}

export async function updateResult(
  resultId: string,
  blackScore: number,
  whiteScore: number
): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("results")
    .update({ black_score: blackScore, white_score: whiteScore })
    .eq("id", resultId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/results");
  return { ok: true };
}

/**
 * Atzīmē manuālu Swedbank pārskaitījumu kā samaksātu.
 */
export async function markPaymentPaid(paymentId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/payments");
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function rejectPayment(paymentId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  // Atzīmē kā failed un atceļ saistīto reģistrāciju, ja tāda ir.
  const { error: payErr } = await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("id", paymentId);
  if (payErr) return { ok: false, error: payErr.message };

  const { error: regErr } = await supabase
    .from("registrations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("payment_id", paymentId);
  if (regErr) return { ok: false, error: regErr.message };

  revalidatePath("/admin/payments");
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function cancelTraining(trainingId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("trainings")
    .update({ status: "cancelled" })
    .eq("id", trainingId);
  if (error) return { ok: false, error: error.message };

  // Atmaksā visus paid Stripe maksājumus šim treniņam.
  await refundPaymentsForTraining(trainingId);

  revalidatePath("/admin/trainings", "layout");
  revalidatePath("/admin/payments");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Iziet caur visiem `paid` Stripe maksājumiem treniņam un izraisa
 * refund'u. Manuālie Swedbank maksājumi tiek tikai atzīmēti — admin
 * pats atgriež naudu pa banku.
 */
async function refundPaymentsForTraining(trainingId: string): Promise<void> {
  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("id, provider, status, stripe_payment_intent_id")
    .eq("training_id", trainingId)
    .eq("status", "paid");

  if (!payments || payments.length === 0) return;

  // Lazy import, lai Stripe SDK netiek loaded, kad nav nepieciešams.
  const { getStripe } = await import("@/lib/stripe");

  for (const p of payments) {
    if (p.provider === "stripe" && p.stripe_payment_intent_id) {
      try {
        const stripe = getStripe();
        await stripe.refunds.create({
          payment_intent: p.stripe_payment_intent_id,
        });
      } catch (e) {
        console.error("[refund] failed for", p.id, e);
        continue;
      }
    }
    await supabase
      .from("payments")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", p.id);
  }
}
