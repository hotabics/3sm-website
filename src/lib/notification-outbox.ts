import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWhatsAppGroupChat } from "@/lib/notifications";

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 10 * 60 * 1000;

type RegistrationUpdatePayload = {
  player_name: string;
  training_date: string;
  start_time: string;
  registration_closes_at: string;
  active_count: number;
  confirmed_count: number;
  queue_count: number;
  max_players: number;
  remaining_slots: number;
};

type OutboxEvent = {
  id: string;
  registration_id: string;
  payload: unknown;
  attempts: number;
};

function asPayload(value: unknown): RegistrationUpdatePayload | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const strings = ["player_name", "training_date", "start_time", "registration_closes_at"];
  const numbers = [
    "active_count",
    "confirmed_count",
    "queue_count",
    "max_players",
    "remaining_slots",
  ];
  if (strings.some((key) => typeof p[key] !== "string")) return null;
  if (numbers.some((key) => typeof p[key] !== "number")) return null;
  return p as unknown as RegistrationUpdatePayload;
}

export function formatRemainingTime(closesAt: string, now = new Date()): string {
  const remainingMs = new Date(closesAt).getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "pieteikšanās slēgta";

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} d.`);
  if (hours) parts.push(`${hours} h.`);
  if (!days && minutes) parts.push(`${minutes} min.`);
  return parts.join(" ") || "mazāk nekā minūte";
}

export function formatRegistrationUpdateMessage(
  payload: RegistrationUpdatePayload,
  now = new Date()
): string {
  const time = payload.start_time.slice(0, 5);
  const queueLine = payload.queue_count > 0 ? `\n⏳ Rindā: ${payload.queue_count}` : "";

  return [
    "⚽ 3SM — jauns pieteikums",
    "",
    `${payload.player_name} pieteicās uz ${payload.training_date} treniņu, ${time}.`,
    `👥 Pieteikušies: ${payload.active_count}`,
    `✅ Pašlaik sastāvā: ${payload.confirmed_count}/${payload.max_players}` + queueLine,
    `🎟️ Brīvas vietas sastāvā: ${payload.remaining_slots}`,
    `🕒 Līdz pieteikšanās beigām: ${formatRemainingTime(payload.registration_closes_at, now)}`,
  ].join("\n");
}

function nextAttemptAt(attempts: number): string {
  // 1, 5, 15 un 60 minūšu aizture. Piektais mēģinājums ir pēdējais.
  const delayMinutes = [1, 5, 15, 60][Math.min(Math.max(attempts - 1, 0), 3)];
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

export async function deliverRegistrationUpdateNotifications(options?: {
  registrationId?: string;
  limit?: number;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const staleLockAt = new Date(now.getTime() - STALE_LOCK_MS).toISOString();

  // Ja funkcija tika pārtraukta starp claim un nosūtīšanu, notikums nekad
  // nepaliek iestrēdzis "processing" stāvoklī.
  await admin
    .from("notification_outbox")
    .update({
      status: "failed",
      locked_at: null,
      last_error: "Piegādes process beidzās pirms rezultāta saglabāšanas.",
      next_attempt_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("event_type", "registration_update")
    .eq("status", "processing")
    .lt("locked_at", staleLockAt);

  let query = admin
    .from("notification_outbox")
    .select("id, registration_id, payload, attempts")
    .eq("event_type", "registration_update")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", now.toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(options?.limit ?? 20);

  if (options?.registrationId) {
    query = query.eq("registration_id", options.registrationId);
  }

  const { data } = await query;
  const events = ((data ?? []) as unknown) as OutboxEvent[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of events) {
    const claimedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from("notification_outbox")
      .update({
        status: "processing",
        attempts: event.attempts + 1,
        locked_at: claimedAt,
        updated_at: claimedAt,
      })
      .eq("id", event.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();

    if (!claimed) continue;

    const payload = asPayload(event.payload);
    if (!payload) {
      failed += 1;
      await admin
        .from("notification_outbox")
        .update({
          status: "failed",
          locked_at: null,
          last_error: "Nederīgs registration_update payload.",
          next_attempt_at: nextAttemptAt(event.attempts + 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      continue;
    }

    const result = await notifyWhatsAppGroupChat(
      formatRegistrationUpdateMessage(payload),
      "registration_update"
    );
    const completedAt = new Date().toISOString();

    if (result.ok) {
      sent += 1;
      await admin
        .from("notification_outbox")
        .update({
          status: "sent",
          locked_at: null,
          last_error: null,
          provider_message_sid: result.providerMessageSid ?? null,
          sent_at: completedAt,
          updated_at: completedAt,
        })
        .eq("id", event.id);
      continue;
    }

    if (result.skipped) {
      skipped += 1;
      await admin
        .from("notification_outbox")
        .update({
          status: "skipped",
          locked_at: null,
          last_error: result.error ?? null,
          updated_at: completedAt,
        })
        .eq("id", event.id);
      continue;
    }

    failed += 1;
    await admin
      .from("notification_outbox")
      .update({
        status: "failed",
        locked_at: null,
        last_error: result.error?.slice(0, 500) ?? "WhatsApp grupas paziņojumu neizdevās nosūtīt.",
        next_attempt_at: nextAttemptAt(event.attempts + 1),
        updated_at: completedAt,
      })
      .eq("id", event.id);
  }

  return { sent, failed, skipped };
}
