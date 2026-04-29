import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { formatRiga } from "@/lib/time";

/**
 * Vercel Cron: dienu pirms treniņa (trešdiena ~18:00 Rīgas) izsūta
 * personīgu atgādinājumu visiem, kas vēl nav pieteikušies uz nākamo
 * ceturtdienas treniņu.
 *
 * Schedule: `0 15,16 * * 3` (trešdiena 18:00 Rīga = 15/16 UTC).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Atrod nākamo `open` treniņu nākamajā dienā.
  const todayUtc = new Date();
  const tomorrow = new Date(todayUtc);
  tomorrow.setUTCDate(todayUtc.getUTCDate() + 1);
  const tomorrowDate = tomorrow.toISOString().slice(0, 10);

  const { data: training } = await admin
    .from("trainings")
    .select("id, date, location")
    .eq("status", "open")
    .eq("date", tomorrowDate)
    .maybeSingle();

  if (!training) {
    return NextResponse.json({ ok: true, skipped: "no training tomorrow" });
  }

  // Visi spēlētāji
  const { data: users } = await admin
    .from("users")
    .select("id")
    .eq("role", "player");

  // Tie, kas jau pieteikušies (statuss != cancelled)
  const { data: regs } = await admin
    .from("registrations")
    .select("user_id")
    .eq("training_id", training.id)
    .neq("status", "cancelled");

  const registered = new Set((regs ?? []).map((r) => r.user_id as string));
  const targets = (users ?? []).filter((u) => !registered.has(u.id));

  const dateLabel = formatRiga(training.date + "T20:00:00Z", "EEEE, d. MMMM");
  const message = `⏰ 3SM: rīt (${dateLabel}) treniņš 20:00 ${training.location}. Vēl neesi pieteicies — https://3sm.lv`;

  await Promise.all(
    targets.map((u) => notifyUser(u.id, message, "reminder"))
  );

  return NextResponse.json({
    ok: true,
    training_id: training.id,
    reminded: targets.length,
  });
}
