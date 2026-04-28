"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Pieteic pašreizējo lietotāju uz treniņu.
 * - Pamatsastāva spēlētāji (`player_type = 'core'`) ar derīgu sezonas maksu → 'confirmed'
 * - Pārējie → 'queue' (gaida apstiprinājumu vai apmaksu)
 */
export async function registerForTraining(trainingId: string): Promise<Result> {
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

  const today = new Date().toISOString().slice(0, 10);
  const isCorePaid =
    profile?.player_type === "core" &&
    profile?.semester_paid_until &&
    profile.semester_paid_until >= today;

  const status = isCorePaid ? "confirmed" : "queue";
  const team =
    isCorePaid && profile?.fixed_team && profile.fixed_team !== "flexible"
      ? profile.fixed_team
      : null;

  // Ja jau atcelts ieraksts eksistē — atjauno; citādi insert.
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
  return { ok: true };
}

/**
 * Atceļ pašreizējā lietotāja reģistrāciju.
 */
export async function cancelRegistration(trainingId: string): Promise<Result> {
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

  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("training_id", trainingId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath(`/training/${trainingId}`);
  return { ok: true };
}
