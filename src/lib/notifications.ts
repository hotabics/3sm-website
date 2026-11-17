import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilio, whatsappFrom, toWhatsappRecipient } from "@/lib/twilio";

type NotificationType =
  | "registration_open"
  | "roster_locked"
  | "team_assigned"
  | "training_cancelled"
  | "reminder"
  | "result_approved"
  | "admin_new_registration"
  | "registration_update"
  | "custom";

type SendOutcome = {
  attempted: number;
  sent: number;
  failed: number;
};

export type GroupSendOutcome = {
  ok: boolean;
  retryable: boolean;
  providerMessageSid?: string;
  error?: string;
  skipped?: boolean;
};

/**
 * Sūta vienu WhatsApp ziņu un ieraksta `notifications` rindu.
 * Ja Twilio env nav uzstādīts, ieraksta kā `failed`, lai admins redz.
 */
async function sendOne(args: {
  userId: string | null;
  toWhatsapp: string | null;
  message: string;
  type: NotificationType;
  channel: "whatsapp_group" | "whatsapp_personal";
}): Promise<boolean> {
  const admin = createAdminClient();
  const baseRow = {
    user_id: args.userId,
    type: args.type,
    channel: args.channel,
    message: args.message,
  };

  const client = getTwilio();
  const from = whatsappFrom();
  if (!client || !from) {
    await admin.from("notifications").insert({
      ...baseRow,
      status: "failed",
      error: "Twilio env not configured",
    });
    return false;
  }

  if (!args.toWhatsapp) {
    await admin.from("notifications").insert({
      ...baseRow,
      status: "failed",
      error: "Recipient has no WhatsApp number",
    });
    return false;
  }

  try {
    await client.messages.create({
      from,
      to: args.toWhatsapp,
      body: args.message,
    });
    await admin.from("notifications").insert({
      ...baseRow,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[notifications] send failed:", msg);
    await admin.from("notifications").insert({
      ...baseRow,
      status: "failed",
      error: msg.slice(0, 500),
    });
    return false;
  }
}

/**
 * Fanout uz visiem aktīviem komandas spēlētājiem ar zināmu WhatsApp.
 * Šī ir vēsturiskā individuālā izsūtīšana, nevis viens WhatsApp grupas čata
 * ziņojums. Auditā katrs saņēmējs tāpēc tiek marķēts kā personal.
 * `audience='all'` = visi non-cancelled lietotāji; `audience='players'`
 * = visi izņemot adminus.
 */
export async function notifyGroup(
  message: string,
  type: NotificationType,
  audience: "all" | "players" = "all"
): Promise<SendOutcome> {
  const admin = createAdminClient();
  let q = admin.from("users").select("id, whatsapp").not("whatsapp", "is", null);
  if (audience === "players") q = q.eq("role", "player");
  const { data: recipients } = await q;

  const list = (recipients ?? []) as { id: string; whatsapp: string | null }[];
  const results = await Promise.all(
    list.map((u) =>
      sendOne({
        userId: u.id,
        toWhatsapp: toWhatsappRecipient(u.whatsapp),
        message,
        type,
        channel: "whatsapp_personal",
      })
    )
  );

  return {
    attempted: list.length,
    sent: results.filter(Boolean).length,
    failed: results.filter((r) => !r).length,
  };
}

/**
 * Nosūta vienu ziņu īstā Twilio Conversations WhatsApp grupā.
 *
 * `notifyGroup` ir vēsturiska individuālā fan-out funkcija. Šī funkcija ir
 * domāta vienam grupas čata ierakstam un tiek izmantota pieteikumu statusa
 * paziņojumiem. Konfigurācija:
 * - WHATSAPP_GROUP_MODE=conversations — sūta uz Conversations SID;
 * - WHATSAPP_GROUP_MODE=fanout — apzināta pārejas alternatīva;
 * - disabled vai tukšs — neko nesūta un outbox notikumu atzīmē kā skipped.
 */
export async function notifyWhatsAppGroupChat(
  message: string,
  type: NotificationType
): Promise<GroupSendOutcome> {
  const mode = process.env.WHATSAPP_GROUP_MODE ?? "disabled";

  if (mode === "disabled") {
    return { ok: false, retryable: false, skipped: true, error: "WhatsApp group delivery is disabled" };
  }

  if (mode === "fanout") {
    const outcome = await notifyGroup(message, type, "all");
    return {
      ok: outcome.failed === 0,
      retryable: outcome.failed > 0,
      error: outcome.failed > 0 ? `${outcome.failed} fan-out ziņas neizdevās nosūtīt.` : undefined,
    };
  }

  if (mode !== "conversations") {
    return {
      ok: false,
      retryable: false,
      skipped: true,
      error: `Nezināms WHATSAPP_GROUP_MODE: ${mode}`,
    };
  }

  const admin = createAdminClient();
  const client = getTwilio();
  const conversationSid = process.env.TWILIO_WHATSAPP_CONVERSATION_SID;
  if (!client || !conversationSid) {
    const error = !client
      ? "Twilio env not configured"
      : "TWILIO_WHATSAPP_CONVERSATION_SID nav uzstādīts";
    await admin.from("notifications").insert({
      user_id: null,
      type,
      channel: "whatsapp_group",
      message,
      status: "failed",
      error,
    });
    return { ok: false, retryable: true, error };
  }

  try {
    const sent = await client.conversations.v1
      .conversations(conversationSid)
      .messages.create({ body: message });
    const { error: auditError } = await admin.from("notifications").insert({
      user_id: null,
      type,
      channel: "whatsapp_group",
      message,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    if (auditError) {
      // Ziņa jau ir pieņemta Twilio pusē. To nedrīkst mēģināt sūtīt atkārtoti
      // tikai lokālas auditēšanas kļūmes dēļ.
      console.error("[notifications] group audit insert failed:", auditError.message);
    }
    return { ok: true, retryable: false, providerMessageSid: sent.sid };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[notifications] group send failed:", error);
    await admin.from("notifications").insert({
      user_id: null,
      type,
      channel: "whatsapp_group",
      message,
      status: "failed",
      error: error.slice(0, 500),
    });
    return { ok: false, retryable: true, error };
  }
}

/**
 * Fanout uz visiem adminiem, kuriem norādīts WhatsApp numurs.
 * Lietots kanālos, kur svarīga ātrā operatīvā informācija (jauni
 * pieteikumi, manuāli pārskaitījumi u.c.).
 */
export async function notifyAdmins(
  message: string,
  type: NotificationType
): Promise<SendOutcome> {
  const admin = createAdminClient();
  const { data: recipients } = await admin
    .from("users")
    .select("id, whatsapp")
    .eq("role", "admin")
    .not("whatsapp", "is", null);

  const list = (recipients ?? []) as { id: string; whatsapp: string | null }[];
  const results = await Promise.all(
    list.map((u) =>
      sendOne({
        userId: u.id,
        toWhatsapp: toWhatsappRecipient(u.whatsapp),
        message,
        type,
        channel: "whatsapp_personal",
      })
    )
  );

  return {
    attempted: list.length,
    sent: results.filter(Boolean).length,
    failed: results.filter((r) => !r).length,
  };
}

/**
 * Personisks paziņojums vienam lietotājam.
 */
export async function notifyUser(
  userId: string,
  message: string,
  type: NotificationType
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("users")
    .select("id, whatsapp")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return false;

  return sendOne({
    userId: user.id,
    toWhatsapp: toWhatsappRecipient(user.whatsapp),
    message,
    type,
    channel: "whatsapp_personal",
  });
}
