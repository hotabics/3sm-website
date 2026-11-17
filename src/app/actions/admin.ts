"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { defaultTrainingTimes } from "@/lib/trainings";
import { requireAdmin } from "@/lib/auth";
import { notifyGroup, notifyUser } from "@/lib/notifications";
import { deliverRegistrationUpdateNotifications } from "@/lib/notification-outbox";
import { refundPaidPaymentsForTraining } from "@/lib/payment-refunds";
import { formatRiga } from "@/lib/time";
import { amountDueFor } from "@/lib/debts";

type Result = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badId(): Result {
  return { ok: false, error: "Nederīgs ID." };
}

export async function createTraining(formData: FormData): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "");
  const location = String(formData.get("location") ?? "Pilna info admin panelī");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Nederīgs datums." };
  }

  const times = defaultTrainingTimes(date);

  const { error } = await supabase.from("trainings").insert({
    date,
    location,
    status: "open",
    ...times,
  });

  if (error) return { ok: false, error: error.message };

  // Paziņojums grupai par atvērto reģistrāciju (best-effort).
  const dateLabel = formatRiga(date + "T20:00:00Z", "EEEE, d. MMMM");
  await notifyGroup(
    `🟣 3SM: reģistrācija atvērta uz ${dateLabel} treniņu (20:00–21:30, ${location}). Piesakies ar vienu klikšķi: https://3sm.lv/?naku=1`,
    "registration_open"
  );

  revalidatePath("/admin/trainings");
  revalidatePath("/");
  return { ok: true };
}

export async function approveRegistration(
  registrationId: string
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(registrationId)) return badId();
  const supabase = await createClient();
  // Ja sastāvs jau fiksēts, apstiprinātajam uzreiz uzliekam maksu (ja jāmaksā).
  const { data: reg } = await supabase
    .from("registrations")
    .select(
      "training:trainings(status), user:users(player_type, semester_paid_until)"
    )
    .eq("id", registrationId)
    .maybeSingle();
  const regInfo = (reg ?? null) as unknown as {
    training: { status: string } | null;
    user: { player_type: "core" | "reserve"; semester_paid_until: string | null } | null;
  } | null;
  const locked =
    regInfo?.training?.status === "closed" ||
    regInfo?.training?.status === "completed";

  const { error } = await supabase
    .from("registrations")
    .update({
      status: "confirmed",
      cancelled_at: null,
      ...(locked ? { amount_due_cents: amountDueFor(regInfo?.user ?? null) } : {}),
    })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function removeRegistration(
  registrationId: string
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(registrationId)) return badId();

  const supabase = await createClient();

  // Refund saistīto Stripe maksājumu, ja tāds bijis paid.
  const { data: reg } = await supabase
    .from("registrations")
    .select("payment_id, payment:payments(id, provider, status, stripe_payment_intent_id)")
    .eq("id", registrationId)
    .maybeSingle();

  type PayInfo = {
    id: string;
    provider: "stripe" | "manual_swedbank";
    status: "pending" | "paid" | "failed" | "refunded";
    stripe_payment_intent_id: string | null;
  };
  const pay = (reg?.payment ?? null) as PayInfo | null;

  if (pay && pay.status === "paid") {
    if (pay.provider === "stripe" && pay.stripe_payment_intent_id) {
      try {
        const { getStripe } = await import("@/lib/stripe");
        await getStripe().refunds.create({
          payment_intent: pay.stripe_payment_intent_id,
        });
      } catch (e) {
        console.error("[refund] failed for", pay.id, e);
      }
    }
    await supabase
      .from("payments")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", pay.id);
  }

  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings", "layout");
  revalidatePath("/admin/payments");
  return { ok: true };
}

/**
 * Drag-and-drop sadalītājs: piešķir vai noņem komandu reģistrācijai.
 */
export async function setTeam(
  registrationId: string,
  team: "black" | "white" | null
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(registrationId)) return badId();
  if (team !== null && team !== "black" && team !== "white") {
    return { ok: false, error: "Nederīga komanda." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({ team })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function approveResult(resultId: string): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(resultId)) return badId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nav pieslēgts." };

  const { data: result, error: fetchError } = await supabase
    .from("results")
    .select("training_id, status")
    .eq("id", resultId)
    .single();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (result.status === "approved")
    return { ok: false, error: "Jau apstiprināts." };

  const { error: updateError } = await supabase
    .from("results")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", resultId);
  if (updateError) return { ok: false, error: updateError.message };

  // Pēc rezultāta apstiprināšanas treniņš → completed (statistikas vajadzībām).
  await supabase
    .from("trainings")
    .update({ status: "completed" })
    .eq("id", result.training_id);

  revalidatePath("/admin/results");
  revalidatePath("/stats");
  revalidatePath(`/training/${result.training_id}`);
  return { ok: true };
}

export async function updateResult(
  resultId: string,
  blackScore: number,
  whiteScore: number
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(resultId)) return badId();
  if (
    !Number.isInteger(blackScore) ||
    blackScore < 0 ||
    blackScore > 99 ||
    !Number.isInteger(whiteScore) ||
    whiteScore < 0 ||
    whiteScore > 99
  ) {
    return { ok: false, error: "Nederīgi rezultāti." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("results")
    .update({ black_score: blackScore, white_score: whiteScore })
    .eq("id", resultId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/results");
  return { ok: true };
}

// =============================================================
// Admin: lietotāju pārvaldība (loma, statuss, fiksētā komanda)
// =============================================================

const ROLES = ["player", "admin"] as const;
const PLAYER_TYPES = ["core", "reserve"] as const;
const FIXED_TEAMS = ["black", "white", "flexible"] as const;

export async function setUserRole(
  userId: string,
  role: "player" | "admin"
): Promise<Result> {
  const me = await requireAdmin();
  if (!UUID_RE.test(userId)) return badId();
  if (!ROLES.includes(role)) return { ok: false, error: "Nederīga loma." };

  // Drošības "guard": admin nedrīkst sevi atroles izņemt no admin —
  // pretējā gadījumā varam palikt bez admin'a.
  if (userId === me.id && role !== "admin") {
    return { ok: false, error: "Sev admin lomu nevar atņemt." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", userId)
    .eq("identity_status", "identified")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "Neidentificētam dalībniekam nevar piešķirt konta lomu." };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserPlayerType(
  userId: string,
  type: "core" | "reserve"
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(userId)) return badId();
  if (!PLAYER_TYPES.includes(type)) {
    return { ok: false, error: "Nederīgs statuss." };
  }

  const supabase = await createClient();
  const update: Record<string, unknown> = { player_type: type };
  // Promote → core: ja sezonas maksa nokavēta, dod gadu derīgu.
  if (type === "core") {
    const { data: u } = await supabase
      .from("users")
      .select("semester_paid_until")
      .eq("id", userId)
      .single();
    const today = new Date().toISOString().slice(0, 10);
    if (!u?.semester_paid_until || u.semester_paid_until < today) {
      update.semester_paid_until = "2026-12-31";
    }
  }

  const { data: updated, error } = await supabase.from("users")
    .update(update)
    .eq("id", userId)
    .eq("identity_status", "identified")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "Neidentificētam dalībniekam nevar mainīt apmaksas statusu." };
  revalidatePath("/admin/users");
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function setUserFixedTeam(
  userId: string,
  team: "black" | "white" | "flexible" | null
): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(userId)) return badId();
  if (team !== null && !FIXED_TEAMS.includes(team)) {
    return { ok: false, error: "Nederīga komanda." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ fixed_team: team })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

/**
 * Atzīmē manuālu Swedbank pārskaitījumu kā samaksātu.
 */
export async function markPaymentPaid(paymentId: string): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(paymentId)) return badId();
  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!payment) return { ok: false, error: "Maksājums nav gaidošā statusā." };

  // Manuālais pārskaitījums grupas paziņojumu saņem tikai pēc admina
  // apstiprinājuma, nevis brīdī, kad spēlētājs paziņo par pārskaitījumu.
  const { data: registration } = await supabase
    .from("registrations")
    .select("id")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (registration) {
    // Datubāzes trigger jau tajā pašā maksājuma transakcijā ievietoja outbox
    // notikumu. Šeit tikai mēģinām to piegādāt uzreiz.
    await deliverRegistrationUpdateNotifications({ registrationId: registration.id });
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

export async function rejectPayment(paymentId: string): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(paymentId)) return badId();
  const supabase = await createClient();
  // Atzīmē kā failed un atsaista no reģistrācijas. Pieteikums paliek spēkā —
  // maksājums nav obligāts; ja spēlēja, tas atkal parādās kā parāds.
  const { error: payErr } = await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("id", paymentId);
  if (payErr) return { ok: false, error: payErr.message };

  const { error: regErr } = await supabase
    .from("registrations")
    .update({ payment_id: null })
    .eq("payment_id", paymentId);
  if (regErr) return { ok: false, error: regErr.message };

  revalidatePath("/admin/payments");
  revalidatePath("/admin/trainings", "layout");
  return { ok: true };
}

/**
 * Sūta WhatsApp katram apstiprinātam spēlētājam, kuram piešķirta komanda,
 * informējot, kuru kreklu paņemt līdzi. Idempotence: ja spēlētāja komanda
 * sakrīt ar `team_notified_for`, ziņa atkārtoti netiek sūtīta. Atgriež
 * sūtīto / izlaisto / kļūdaino skaitus, lai admins redz, kas notika.
 */
export async function broadcastTeamAssignments(
  trainingId: string
): Promise<
  | { ok: true; sent: number; skipped: number; missingTeam: number; failed: number }
  | { ok: false; error: string }
> {
  await requireAdmin();
  if (!UUID_RE.test(trainingId)) return { ok: false, error: "Nederīgs ID." };

  const supabase = await createClient();

  const { data: training } = await supabase
    .from("trainings")
    .select("date")
    .eq("id", trainingId)
    .maybeSingle();
  if (!training) return { ok: false, error: "Treniņš nav atrasts." };

  const { data: regs } = await supabase
    .from("registrations")
    .select("id, user_id, team, team_notified_for")
    .eq("training_id", trainingId)
    .eq("status", "confirmed");

  type Reg = {
    id: string;
    user_id: string;
    team: "black" | "white" | null;
    team_notified_for: "black" | "white" | null;
  };
  const list = ((regs ?? []) as Reg[]) ?? [];

  const dateLabel = formatRiga(training.date + "T20:00:00Z", "EEEE, d. MMMM");

  let sent = 0;
  let skipped = 0;
  let missingTeam = 0;
  let failed = 0;

  await Promise.all(
    list.map(async (r) => {
      if (r.team !== "black" && r.team !== "white") {
        missingTeam += 1;
        return;
      }
      if (r.team_notified_for === r.team) {
        skipped += 1;
        return;
      }
      const teamLabel = r.team === "black" ? "Melnajā" : "Baltajā";
      const shirt = r.team === "black" ? "MELNU" : "BALTU";
      const ok = await notifyUser(
        r.user_id,
        `🎽 3SM ${dateLabel}: tu spēlē ${teamLabel} komandā. Paņem līdzi ${shirt} kreklu. 20:00 Olimpiskajā centrā.`,
        "team_assigned"
      );
      if (ok) {
        sent += 1;
        await supabase
          .from("registrations")
          .update({
            team_notified_for: r.team,
            team_notified_at: new Date().toISOString(),
          })
          .eq("id", r.id);
      } else {
        failed += 1;
      }
    })
  );

  revalidatePath(`/admin/trainings/${trainingId}/teams`);
  revalidatePath(`/training/${trainingId}`);
  return { ok: true, sent, skipped, missingTeam, failed };
}

export async function cancelTraining(trainingId: string): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(trainingId)) return badId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("trainings")
    .update({ status: "cancelled" })
    .eq("id", trainingId);
  if (error) return { ok: false, error: error.message };

  // Atmaksā visus paid Stripe maksājumus šim treniņam.
  await refundPaidPaymentsForTraining(trainingId);

  // Paziņojums grupai (best-effort).
  const { data: t } = await supabase
    .from("trainings")
    .select("date")
    .eq("id", trainingId)
    .maybeSingle();
  if (t?.date) {
    const dateLabel = formatRiga(t.date + "T20:00:00Z", "EEEE, d. MMMM");
    await notifyGroup(
      `🔴 3SM: ${dateLabel} treniņš atcelts. Samaksātie pārskaitījumi tiek atmaksāti.`,
      "training_cancelled"
    );
  }

  revalidatePath("/admin/trainings", "layout");
  revalidatePath("/admin/payments");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Admins atzīmē parādu kā nomaksātu (skaidrā naudā vai pārskaitījums, kas
 * netika pieteikts lietotnē): izveido 'paid' maksājumu un piesaista.
 */
export async function markDebtPaid(registrationId: string): Promise<Result> {
  await requireAdmin();
  if (!UUID_RE.test(registrationId)) return badId();
  const supabase = await createClient();

  const { data: reg } = await supabase
    .from("registrations")
    .select("id, user_id, training_id, amount_due_cents, payment_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || reg.amount_due_cents <= 0) {
    return { ok: false, error: "Parāds nav atrasts." };
  }

  // Ja jau ir gaidošs Swedbank maksājums — vienkārši apstiprinām to.
  if (reg.payment_id) {
    const { data: pay } = await supabase
      .from("payments")
      .select("id, status")
      .eq("id", reg.payment_id)
      .maybeSingle();
    if (pay?.status === "paid") return { ok: true };
    if (pay?.status === "pending") {
      return markPaymentPaid(pay.id);
    }
  }

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      user_id: reg.user_id,
      type: "single_training",
      amount_cents: reg.amount_due_cents,
      currency: "eur",
      provider: "manual_swedbank",
      status: "paid",
      paid_at: new Date().toISOString(),
      training_id: reg.training_id,
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    return { ok: false, error: payErr?.message ?? "Neizdevās saglabāt." };
  }

  const { error } = await supabase
    .from("registrations")
    .update({ payment_id: payment.id })
    .eq("id", reg.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/payments");
  return { ok: true };
}
