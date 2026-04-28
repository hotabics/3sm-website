import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vercel Cron: aizver reģistrāciju treniņiem, kuriem `registration_closes_at <= now()`.
 *
 * Loģika:
 *  - kopā >= min_players → top max_players paliek 'confirmed' (pamatsastāvs > rezervisti FIFO),
 *    pārējie paliek 'queue', treniņš → 'closed'
 *  - citādi → treniņš → 'cancelled', visiem rezervistiem jānotiek atmaksa (Fāze 4)
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: trainings, error: trainingsError } = await supabase
    .from("trainings")
    .select("id, max_players, min_players")
    .eq("status", "open")
    .lte("registration_closes_at", now);

  if (trainingsError) {
    return NextResponse.json({ error: trainingsError.message }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const t of trainings ?? []) {
    const { data: regs } = await supabase
      .from("registrations")
      .select(
        `id, status, registered_at,
         user:users(player_type, fixed_team, semester_paid_until)`
      )
      .eq("training_id", t.id)
      .neq("status", "cancelled")
      .order("registered_at", { ascending: true });

    type RegRow = {
      id: string;
      status: string;
      registered_at: string;
      user: {
        player_type: "core" | "reserve";
        fixed_team: "black" | "white" | "flexible" | null;
        semester_paid_until: string | null;
      } | null;
    };

    const regsTyped = ((regs ?? []) as unknown) as RegRow[];

    if (regsTyped.length < t.min_players) {
      // Pārāk maz — atcel.
      await supabase
        .from("trainings")
        .update({ status: "cancelled" })
        .eq("id", t.id);
      results.push({ training_id: t.id, action: "cancelled", reason: "below_min" });
      continue;
    }

    const today = now.slice(0, 10);
    const sorted = [...regsTyped].sort((a, b) => {
      const ap =
        a.user?.player_type === "core" &&
        a.user?.semester_paid_until &&
        a.user.semester_paid_until >= today
          ? 0
          : 1;
      const bp =
        b.user?.player_type === "core" &&
        b.user?.semester_paid_until &&
        b.user.semester_paid_until >= today
          ? 0
          : 1;
      if (ap !== bp) return ap - bp;
      return a.registered_at.localeCompare(b.registered_at);
    });

    const confirmed = sorted.slice(0, t.max_players);
    const queue = sorted.slice(t.max_players);

    if (confirmed.length > 0) {
      await supabase
        .from("registrations")
        .update({ status: "confirmed" })
        .in(
          "id",
          confirmed.map((r) => r.id)
        );
    }
    if (queue.length > 0) {
      await supabase
        .from("registrations")
        .update({ status: "queue" })
        .in(
          "id",
          queue.map((r) => r.id)
        );
    }

    await supabase.from("trainings").update({ status: "closed" }).eq("id", t.id);
    results.push({
      training_id: t.id,
      action: "closed",
      confirmed: confirmed.length,
      queue: queue.length,
    });
  }

  return NextResponse.json({ ok: true, processed: results });
}
