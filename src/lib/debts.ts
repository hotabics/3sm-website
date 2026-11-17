import { createClient } from "@/lib/supabase/server";
import { SINGLE_TRAINING_PRICE_CENTS } from "@/lib/stripe";

/** Pamatsastāvs ar derīgu sezonas maksu — par treniņiem atsevišķi nemaksā. */
export function isCorePaid(
  user: {
    player_type: "core" | "reserve" | null | undefined;
    semester_paid_until: string | null | undefined;
  } | null,
  todayIso = new Date().toISOString().slice(0, 10)
): boolean {
  return (
    user?.player_type === "core" &&
    !!user.semester_paid_until &&
    user.semester_paid_until >= todayIso
  );
}

/** Cik jāmaksā par vienu nospēlētu treniņu (0 pamatsastāvam ar sezonu). */
export function amountDueFor(
  user: Parameters<typeof isCorePaid>[0],
  todayIso?: string
): number {
  return isCorePaid(user, todayIso) ? 0 : SINGLE_TRAINING_PRICE_CENTS;
}

export type Debt = {
  registrationId: string;
  trainingId: string;
  date: string;
  amountCents: number;
  /** Swedbank pārskaitījums pieteikts, gaida admina apstiprinājumu. */
  pendingTransfer: boolean;
};

type DebtRow = {
  id: string;
  training_id: string;
  amount_due_cents: number;
  training: { date: string; status: string } | null;
  payment: { status: string; provider: string } | null;
};

/**
 * Nesamaksātie treniņi: spēlēji (sastāvs fiksēts), bet maksājums nav
 * 'paid'. Atceltie treniņi un rindā palikušie parādu nerada.
 */
export async function getMyDebts(userId: string): Promise<Debt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select(
      `id, training_id, amount_due_cents,
       training:trainings(date, status),
       payment:payments!registrations_payment_fkey(status, provider)`
    )
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gt("amount_due_cents", 0);

  return (((data ?? []) as unknown) as DebtRow[])
    .filter(
      (r) =>
        r.training &&
        (r.training.status === "closed" || r.training.status === "completed") &&
        r.payment?.status !== "paid"
    )
    .map((r) => ({
      registrationId: r.id,
      trainingId: r.training_id,
      date: r.training!.date,
      amountCents: r.amount_due_cents,
      pendingTransfer:
        r.payment?.provider === "manual_swedbank" &&
        r.payment.status === "pending",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
