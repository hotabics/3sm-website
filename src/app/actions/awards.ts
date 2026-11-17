"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { ok: true } | { ok: false; error: string };

/**
 * Iestāda komandas MVP. `userId=null` → noņem MVP.
 * MVP ir viens katras komandas titulam vienā treniņā (DB unikāls indekss).
 */
export async function setMvp(
  trainingId: string,
  team: "black" | "white",
  userId: string | null
): Promise<Result> {
  const me = await requireAdmin();
  if (!UUID_RE.test(trainingId)) return { ok: false, error: "Nederīgs ID." };
  if (team !== "black" && team !== "white") {
    return { ok: false, error: "Nederīga komanda." };
  }
  if (userId !== null && !UUID_RE.test(userId)) {
    return { ok: false, error: "Nederīgs spēlētāja ID." };
  }

  const supabase = await createClient();
  const awardType = team === "black" ? "mvp_black" : "mvp_white";

  // Pārbauda, vai izvēlētais spēlētājs tiešām spēlēja attiecīgajā komandā.
  if (userId) {
    const { data: reg } = await supabase
      .from("registrations")
      .select("id")
      .eq("training_id", trainingId)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .eq("team", team)
      .maybeSingle();
    if (!reg) {
      return {
        ok: false,
        error: "Spēlētājs nav apstiprināts šajā komandā.",
      };
    }
  }

  const { data: existing } = await supabase
    .from("match_awards")
    .select("id")
    .eq("training_id", trainingId)
    .eq("award_type", awardType)
    .maybeSingle();

  if (existing) {
    if (userId === null) {
      const { error } = await supabase
        .from("match_awards")
        .delete()
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("match_awards")
        .update({ user_id: userId, created_by: me.id })
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    }
  } else if (userId !== null) {
    const { error } = await supabase.from("match_awards").insert({
      training_id: trainingId,
      user_id: userId,
      award_type: awardType,
      created_by: me.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/training/${trainingId}`);
  revalidatePath("/stats");
  return { ok: true };
}

/**
 * Pievieno custom apbalvojumu (brīvas formas teksts) konkrētam spēlētājam.
 */
export async function addCustomAward(
  trainingId: string,
  userId: string,
  label: string
): Promise<Result> {
  const me = await requireAdmin();
  if (!UUID_RE.test(trainingId)) return { ok: false, error: "Nederīgs ID." };
  if (!UUID_RE.test(userId)) {
    return { ok: false, error: "Nederīgs spēlētāja ID." };
  }
  const trimmed = label.trim().slice(0, 80);
  if (trimmed.length < 2) {
    return { ok: false, error: "Apbalvojuma nosaukums pārāk īss." };
  }

  const supabase = await createClient();

  // Pārbauda, ka spēlētājs piedalījās treniņā.
  const { data: reg } = await supabase
    .from("registrations")
    .select("id")
    .eq("training_id", trainingId)
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .maybeSingle();
  if (!reg) {
    return { ok: false, error: "Spēlētājs nav apstiprināts šim treniņam." };
  }

  const { error } = await supabase.from("match_awards").insert({
    training_id: trainingId,
    user_id: userId,
    award_type: "custom",
    label: trimmed,
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/training/${trainingId}`);
  revalidatePath("/stats");
  return { ok: true };
}

export async function removeAward(awardId: string): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(awardId)) return { ok: false, error: "Nederīgs ID." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("match_awards")
    .select("training_id")
    .eq("id", awardId)
    .maybeSingle();

  const { error } = await supabase.from("match_awards").delete().eq("id", awardId);
  if (error) return { ok: false, error: error.message };

  if (existing?.training_id) {
    revalidatePath(`/training/${existing.training_id}`);
  }
  revalidatePath("/stats");
  return { ok: true };
}
