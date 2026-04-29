import twilio, { Twilio } from "twilio";

let cached: Twilio | null = null;

/**
 * Lazy Twilio client. Atgriež null, ja env nav uzstādīts — saucošais
 * kods atbild "skip" un ieraksta paziņojumu kā 'failed' ar paskaidrojumu.
 */
export function getTwilio(): Twilio | null {
  if (cached) return cached;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  cached = twilio(sid, token);
  return cached;
}

export function whatsappFrom(): string | null {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) return null;
  return from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
}

/**
 * Latvijas mobilais numurs uz E.164 + WhatsApp prefiksu.
 * Pieņem "+371 26779672", "26779672" un "26779672"; tukšu/null → null.
 */
export function toWhatsappRecipient(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9+]/g, "");
  if (!digits) return null;
  const e164 = digits.startsWith("+")
    ? digits
    : digits.startsWith("371")
    ? `+${digits}`
    : `+371${digits}`;
  return `whatsapp:${e164}`;
}
