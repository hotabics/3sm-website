import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Stripe klients ar Latvijas-orientētu konfigurāciju.
 * Lazy init, lai env mainīgā trūkums neizšķirstītu lapas, kas to neizmanto.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY nav uzstādīts.");
  }
  cached = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
  return cached;
}

export const SINGLE_TRAINING_PRICE_CENTS = 800; // 8.00 EUR
