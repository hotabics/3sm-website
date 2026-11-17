import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export type RefundSummary = {
  refunded: number;
  failed: number;
  manualRefunds: number;
};

/**
 * Atmaksā vai atzīmē atmaksai visus samaksātos treniņa maksājumus.
 * Stripe maksājumiem tiek izveidota īsta Stripe atmaksa. Manuāliem
 * Swedbank pārskaitījumiem sistēma nevar pārskaitīt naudu, tāpēc tie tiek
 * atzīmēti kā refunded un parādās admina auditā.
 */
export async function refundPaidPaymentsForTraining(
  trainingId: string
): Promise<RefundSummary> {
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from("payments")
    .select("id, provider, stripe_payment_intent_id")
    .eq("training_id", trainingId)
    .eq("status", "paid");

  const summary: RefundSummary = { refunded: 0, failed: 0, manualRefunds: 0 };
  for (const payment of payments ?? []) {
    if (payment.provider === "stripe" && payment.stripe_payment_intent_id) {
      try {
        await getStripe().refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
        });
      } catch (error) {
        console.error("[refund] failed for", payment.id, error);
        summary.failed += 1;
        continue;
      }
    }

    const { error } = await admin
      .from("payments")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "paid");
    if (error) {
      console.error("[refund] could not update", payment.id, error);
      summary.failed += 1;
      continue;
    }

    summary.refunded += 1;
    if (payment.provider === "manual_swedbank") summary.manualRefunds += 1;
  }

  return summary;
}
