"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCorePaid } from "@/lib/debts";

type Result = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RegisterOutcome =
  | {
      ok: true;
      status: "confirmed" | "queue";
      /** Var samaksāt uzreiz (neobligāti) — rezervists vai bez sezonas maksas. */
      canPay: boolean;
    }
  | { ok: false; error: string };

/**
 * Pieteic pašreizējo lietotāju uz treniņu ar vienu pieskārienu.
 *
 * Maksājums NAV priekšnoteikums:
 * - Pamatsastāvs ar derīgu sezonas maksu → 'confirmed' (+ fiksētā komanda).
 * - Pārējie → 'queue' līdz sastāva fiksēšanai; cron tos sakārto (pamatsastāvs
 *   pirmais, tad FIFO) un tiem, kas tiek sastāvā, uzliek 8,50 € parādu.
 *   Samaksāt var uzreiz vai vēlāk.
 */
export async function registerForTraining(
  trainingId: string
): Promise<RegisterOutcome> {
  if (!UUID_RE.test(trainingId)) {
    return { ok: false, error: "Nederīgs treniņa ID." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nav pieslēgts." };

  const { data: training } = await supabase
    .from("trainings")
    .select("id, status, registration_closes_at")
    .eq("id", trainingId)
    .maybeSingle();

  if (!training) return { ok: false, error: "Treniņš nav atrasts." };
  if (training.status !== "open") {
    return { ok: false, error: "Reģistrācija slēgta." };
  }
  if (new Date(training.registration_closes_at) <= new Date()) {
    return { ok: false, error: "Reģistrācijas laiks beidzies." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("player_type, semester_paid_until, fixed_team")
    .eq("id", user.id)
    .single();

  const corePaid = isCorePaid(profile);
  const status = corePaid ? "confirmed" : "queue";
  const team =
    corePaid && profile?.fixed_team && profile.fixed_team !== "flexible"
      ? profile.fixed_team
      : null;

  const { data: existing } = await supabase
    .from("registrations")
    .select("id, status")
    .eq("training_id", trainingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.status !== "cancelled") {
      return { ok: false, error: "Tu jau esi pieteicies." };
    }
    const { error } = await supabase
      .from("registrations")
      .update({
        status,
        team,
        cancelled_at: null,
        registered_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("registrations").insert({
      training_id: trainingId,
      user_id: user.id,
      status,
      team,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/training/${trainingId}`);
  return { ok: true, status, canPay: !corePaid };
}

/**
 * Atceļ pašreizējā lietotāja reģistrāciju (līdz reģistrācijas slēgšanai).
 * Ja par šo treniņu jau samaksāts ar karti — atmaksā. Neapstiprināts
 * Swedbank pārskaitījums tiek noņemts.
 */
export async function cancelRegistration(trainingId: string): Promise<Result> {
  if (!UUID_RE.test(trainingId)) {
    return { ok: false, error: "Nederīgs treniņa ID." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nav pieslēgts." };

  const { data: training } = await supabase
    .from("trainings")
    .select("status, registration_closes_at")
    .eq("id", trainingId)
    .maybeSingle();

  if (!training) return { ok: false, error: "Treniņš nav atrasts." };
  if (training.status === "completed" || training.status === "cancelled") {
    return { ok: false, error: "Treniņš jau pabeigts vai atcelts." };
  }
  if (new Date(training.registration_closes_at) <= new Date()) {
    return { ok: false, error: "Atcelšana vairs nav iespējama (pēc 17:00)." };
  }

  const { data: reg, error } = await supabase
    .from("registrations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("training_id", trainingId)
    .eq("user_id", user.id)
    .select("id, payment_id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  if (reg?.payment_id) {
    await releasePayment(reg.id, reg.payment_id);
  }

  revalidatePath("/");
  revalidatePath(`/training/${trainingId}`);
  return { ok: true };
}

/** Atsaista maksājumu no atceltas reģistrācijas; karti atmaksā. */
async function releasePayment(registrationId: string, paymentId: string) {
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("id, provider, status, stripe_payment_intent_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay) return;

  if (pay.status === "paid" && pay.provider === "stripe" && pay.stripe_payment_intent_id) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      await getStripe().refunds.create({
        payment_intent: pay.stripe_payment_intent_id,
      });
      await admin
        .from("payments")
        .update({ status: "refunded", refunded_at: new Date().toISOString() })
        .eq("id", pay.id);
    } catch (e) {
      // Atmaksa neizdevās — atstājam maksājumu piesaistītu, admins redzēs.
      console.error("[cancel refund] failed for", pay.id, e);
      return;
    }
  } else if (pay.status === "pending") {
    await admin.from("payments").update({ status: "failed" }).eq("id", pay.id);
  } else {
    // Samaksāts ar Swedbank — paliek piesaistīts; ja pieteiksies atpakaļ,
    // maksājums joprojām derīgs. Atmaksu admins kārto manuāli.
    return;
  }

  await admin
    .from("registrations")
    .update({ payment_id: null })
    .eq("id", registrationId);
}
