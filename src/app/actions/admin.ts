"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { defaultTrainingTimes } from "@/lib/trainings";
import { requireAdmin } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badId(): Result {
  return { ok: false, error: "Nederīgs ID." };
}

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
  if (!UUID_RE.test(registrationId)) return badId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({
      status: "confirmed",
      cancelled_at: null,
    })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function removeRegistration(
  registrationId: string
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(registrationId)) return badId();

  const supabase = await createClient();

  // Refund saistīto Stripe maksājumu, ja tāds bijis paid.
  const { data: reg } = await supabase
    .from("registrations")
    .select("payment_id, payment:payments(id, provider, status, stripe_payment_intent_id)")
    .eq("id", registrationId)
    .maybeSingle();

  type PayInfo = {
    id: string;
    provider: "stripe" | "manual_swedbank";
    status: "pending" | "paid" | "failed" | "refunded";
    stripe_payment_intent_id: string | null;
  };
  const pay = (reg?.payment ?? null) as PayInfo | null;

  if (pay && pay.status === "paid") {
    if (pay.provider === "stripe" && pay.stripe_payment_intent_id) {
      try {
        const { getStripe } = await import("@/lib/stripe");
        await getStripe().refunds.create({
          payment_intent: pay.stripe_payment_intent_id,
        });
      } catch (e) {
        console.error("[refund] failed for", pay.id, e);
      }
    }
    await supabase
      .from("payments")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", pay.id);
  }

  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings", "layout");
  revalidatePath("/admin/payments");
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
  if (!UUID_RE.test(registrationId)) return badId();
  if (team !== null && team !== "black" && team !== "white") {
    return { ok: false, error: "Nederīga komanda." };
  }
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
  if (!UUID_RE.test(resultId)) return badId();
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
  if (!UUID_RE.test(resultId)) return badId();
  if (
    !Number.isInteger(blackScore) ||
    blackScore < 0 ||
    blackScore > 99 ||
    !Number.isInteger(whiteScore) ||
    whiteScore < 0 ||
    whiteScore > 99
  ) {
    return { ok: false, error: "Nederīgi rezultāti." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("results")
    .update({ black_score: blackScore, white_score: whiteScore })
    .eq("id", resultId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/results");
  return { ok: true };
}

// =============================================================
// Admin: lietotāju pārvaldība (loma, statuss, fiksētā komanda)
// =============================================================

const ROLES = ["player", "admin"] as const;
const PLAYER_TYPES = ["core", "reserve"] as const;
const FIXED_TEAMS = ["black", "white", "flexible"] as const;

export async function setUserRole(
  userId: string,
  role: "player" | "admin"
): Promise<Result> {
  const me = await requireAdmin();
  if (!UUID_RE.test(userId)) return badId();
  if (!ROLES.includes(role)) return { ok: false, error: "Nederīga loma." };

  // Drošības "guard": admin nedrīkst sevi atroles izņemt no admin —
  // pretējā gadījumā varam palikt bez admin'a.
  if (userId === me.id && role !== "admin") {
    return { ok: false, error: "Sev admin lomu nevar atņemt." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserPlayerType(
  userId: string,
  type: "core" | "reserve"
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(userId)) return badId();
  if (!PLAYER_TYPES.includes(type)) {
    return { ok: false, error: "Nederīgs statuss." };
  }

  const supabase = await createClient();
  const update: Record<string, unknown> = { player_type: type };
  // Promote → core: ja sezonas maksa nokavēta, dod gadu derīgu.
  if (type === "core") {
    const { data: u } = await supabase
      .from("users")
      .select("semester_paid_until")
      .eq("id", userId)
      .single();
    const today = new Date().toISOString().slice(0, 10);
    if (!u?.semester_paid_until || u.semester_paid_until < today) {
      update.semester_paid_until = "2026-12-31";
    }
  }

  const { error } = await supabase.from("users").update(update).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function setUserFixedTeam(
  userId: string,
  team: "black" | "white" | "flexible" | null
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(userId)) return badId();
  if (team !== null && !FIXED_TEAMS.includes(team)) {
    return { ok: false, error: "Nederīga komanda." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ fixed_team: team })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

/**
 * Atzīmē manuālu Swedbank pārskaitījumu kā samaksātu.
 */
export async function markPaymentPaid(paymentId: string): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(paymentId)) return badId();
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
  if (!UUID_RE.test(paymentId)) return badId();
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
  if (!UUID_RE.test(trainingId)) return badId();
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
