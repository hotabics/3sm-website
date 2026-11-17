import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildIcs } from "@/lib/calendar";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Atgriež `.ics` failu konkrētam treniņam, lai lietotājs to var ievietot
 * jebkurā kalendāra aplikācijā (Apple Calendar, Outlook, Google Import).
 * Publiska, anonīmi pieejama — tikai pamatinformācija (datums, laiks, vieta).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: training } = await admin
    .from("trainings")
    .select("id, date, start_time, end_time, location")
    .eq("id", id)
    .maybeSingle();

  if (!training) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://3sm.lv";
  const ics = buildIcs({
    trainingId: training.id,
    date: training.date,
    startTime: training.start_time,
    endTime: training.end_time,
    location: training.location ?? "Olimpiskais centrs",
    appUrl,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="3sm-${training.date}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
