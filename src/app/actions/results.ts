"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Iesniegt rezultātu. RLS atļauj tikai treniņa apstiprinātajiem dalībniekiem.
 */
export async function submitResult(
  trainingId: string,
  blackScore: number,
  whiteScore: number
): Promise<Result> {
  if (!Number.isInteger(blackScore) || blackScore < 0)
    return { ok: false, error: "Nederīgs Melnās rezultāts." };
  if (!Number.isInteger(whiteScore) || whiteScore < 0)
    return { ok: false, error: "Nederīgs Baltās rezultāts." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nav pieslēgts." };

  const { data: existing } = await supabase
    .from("results")
    .select("id, status")
    .eq("training_id", trainingId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "approved") {
      return { ok: false, error: "Rezultāts jau apstiprināts." };
    }
    // Pārraksta gaidošo iesniegumu.
    const { error } = await supabase
      .from("results")
      .update({
        black_score: blackScore,
        white_score: whiteScore,
        submitted_by: user.id,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("results").insert({
      training_id: trainingId,
      black_score: blackScore,
      white_score: whiteScore,
      submitted_by: user.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/training/${trainingId}`);
  revalidatePath("/admin/results");
  return { ok: true };
}
