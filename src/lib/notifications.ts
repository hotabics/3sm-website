import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilio, whatsappFrom, toWhatsappRecipient } from "@/lib/twilio";

type NotificationType =
  | "registration_open"
  | "roster_locked"
  | "team_assigned"
  | "training_cancelled"
  | "reminder"
  | "result_approved"
  | "custom";

type SendOutcome = {
  attempted: number;
  sent: number;
  failed: number;
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
        channel: "whatsapp_group",
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
