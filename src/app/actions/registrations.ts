"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deliverRegistrationUpdateNotifications } from "@/lib/notification-outbox";

type Result = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RegisterOutcome =
  | { ok: true; needsPayment?: false }
  | { ok: true; needsPayment: true }
  | { ok: false; error: string };

/**
 * Pieteic pašreizējo lietotāju uz treniņu.
 * - Pamatsastāva spēlētāji (`player_type = 'core'`) ar derīgu sezonas maksu →
 *   uzreiz 'confirmed' (un fiksētā komanda, ja tāda ir).
 * - Pārējie → atgriež `needsPayment: true`, klientam jāatver maksājuma modāls
 *   un jāizsauc `startReservePayment`. Reģistrācijas ieraksts šajā soļā netiek
 *   izveidots.
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

  const { data: profile } = await supabase
    .from("users")
    .select("player_type, semester_paid_until")
    .eq("id", user.id)
    .single();

  const today = new Date().toISOString().slice(0, 10);
  const isCorePaid =
    profile?.player_type === "core" &&
    profile?.semester_paid_until &&
    profile.semester_paid_until >= today;

  if (!isCorePaid) {
    // Rezervists vai pamatsastāvs ar nokavētu sezonas maksu — vajag 8 EUR.
    return { ok: true, needsPayment: true };
  }

  const { data: registrationId, error } = await supabase.rpc(
    "register_core_for_training",
    { p_training_id: trainingId }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath(`/training/${trainingId}`);

  // Piegādes kļūme neatceļ jau veiksmīgu pieteikumu: notikums paliek outbox
  // un cron to mēģinās vēlreiz.
  if (registrationId) {
    await deliverRegistrationUpdateNotifications({ registrationId });
  }

  return { ok: true };
}

/**
 * Atceļ pašreizējā lietotāja reģistrāciju.
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

  const { error } = await supabase.rpc("cancel_my_registration", {
    p_training_id: trainingId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath(`/training/${trainingId}`);
  return { ok: true };
}
