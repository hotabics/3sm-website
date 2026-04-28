import { createClient } from "@/lib/supabase/server";

export type PlayerStats = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  black_count: number;
  white_count: number;
  win_rate: number;
};

type Row = {
  user_id: string;
  team: "black" | "white";
  user: { name: string | null; avatar_url: string | null } | null;
  training: {
    id: string;
    result: { black_score: number; white_score: number; status: string }[] | null;
  } | null;
};

/**
 * Saskaita statistiku no apstiprinātiem rezultātiem.
 * Skaita TIKAI registrations ar status='confirmed' un team set, un tikai
 * tos treniņus, kuriem ir apstiprināts rezultāts.
 */
export async function computeStats(userId?: string): Promise<PlayerStats[]> {
  const supabase = await createClient();

  let query = supabase
    .from("registrations")
    .select(
      `user_id, team,
       user:users(name, avatar_url),
       training:trainings(
         id,
         result:results(black_score, white_score, status)
       )`
    )
    .eq("status", "confirmed")
    .not("team", "is", null);

  if (userId) query = query.eq("user_id", userId);

  const { data } = await query;
  const rows = ((data ?? []) as unknown) as Row[];

  const map = new Map<string, PlayerStats>();

  for (const row of rows) {
    const result = row.training?.result?.[0];
    if (!result || result.status !== "approved") continue;

    let s = map.get(row.user_id);
    if (!s) {
      s = {
        user_id: row.user_id,
        name: row.user?.name ?? null,
        avatar_url: row.user?.avatar_url ?? null,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        black_count: 0,
        white_count: 0,
        win_rate: 0,
      };
      map.set(row.user_id, s);
    }

    s.played += 1;
    if (row.team === "black") s.black_count += 1;
    else s.white_count += 1;

    const myScore = row.team === "black" ? result.black_score : result.white_score;
    const oppScore = row.team === "black" ? result.white_score : result.black_score;
    if (myScore > oppScore) s.wins += 1;
    else if (myScore < oppScore) s.losses += 1;
    else s.draws += 1;
  }

  for (const s of map.values()) {
    s.win_rate = s.played === 0 ? 0 : s.wins / s.played;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.played !== a.played) return b.played - a.played;
    return b.win_rate - a.win_rate;
  });
}
