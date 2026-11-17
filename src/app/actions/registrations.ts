"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverRegistrationUpdateNotifications } from "@/lib/notification-outbox";

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

  // Treniņa statusa, laika un dublikātu pārbaudes notiek DB funkcijā zem
  // rindas bloķēšanas, lai paralēli pieteikumi nevarētu apiet robežas.
  const { data, error } = await supabase.rpc("register_for_training", {
    p_training_id: trainingId,
  });
  if (error) return { ok: false, error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { registration_id: string; registration_status: "confirmed" | "queue" }
    | null;
  if (!row) return { ok: false, error: "Neizdevās pieteikties." };

  revalidatePath("/");
  revalidatePath(`/training/${trainingId}`);

  // Piegādes kļūme neatceļ jau veiksmīgu pieteikumu: notikums paliek outbox
  // un cron to mēģinās vēlreiz.
  await deliverRegistrationUpdateNotifications({
    registrationId: row.registration_id,
  });

  const status = row.registration_status;
  return { ok: true, status, canPay: status !== "confirmed" };
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

  const { error } = await supabase.rpc("cancel_my_registration", {
    p_training_id: trainingId,
  });
  if (error) return { ok: false, error: error.message };

  const { data: reg } = await createAdminClient()
    .from("registrations")
    .select("id, payment_id")
    .eq("training_id", trainingId)
    .eq("user_id", user.id)
    .maybeSingle();

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
