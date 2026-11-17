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
  mvp_count: number;
  custom_awards_count: number;
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

  function ensure(uid: string, name: string | null, avatar: string | null) {
    let s = map.get(uid);
    if (!s) {
      s = {
        user_id: uid,
        name,
        avatar_url: avatar,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        black_count: 0,
        white_count: 0,
        win_rate: 0,
        mvp_count: 0,
        custom_awards_count: 0,
      };
      map.set(uid, s);
    }
    return s;
  }

  for (const row of rows) {
    const result = row.training?.result?.[0];
    if (!result || result.status !== "approved") continue;

    const s = ensure(row.user_id, row.user?.name ?? null, row.user?.avatar_url ?? null);

    s.played += 1;
    if (row.team === "black") s.black_count += 1;
    else s.white_count += 1;

    const myScore = row.team === "black" ? result.black_score : result.white_score;
    const oppScore = row.team === "black" ? result.white_score : result.black_score;
    if (myScore > oppScore) s.wins += 1;
    else if (myScore < oppScore) s.losses += 1;
    else s.draws += 1;
  }

  // Apbalvojumi: skaita tikai pret apstiprinātiem rezultātiem, lai
  // statistikas summa atbilst spēļu summai.
  let awardsQuery = supabase
    .from("match_awards")
    .select(
      `user_id, award_type,
       user:users(name, avatar_url),
       training:trainings(result:results(status))`
    );
  if (userId) awardsQuery = awardsQuery.eq("user_id", userId);

  type AwardRow = {
    user_id: string;
    award_type: "mvp_black" | "mvp_white" | "custom";
    user: { name: string | null; avatar_url: string | null } | null;
    training: { result: { status: string }[] | null } | null;
  };
  const { data: awardData } = await awardsQuery;
  const awardRows = ((awardData ?? []) as unknown) as AwardRow[];

  for (const a of awardRows) {
    const approved = a.training?.result?.[0]?.status === "approved";
    if (!approved) continue;
    const s = ensure(a.user_id, a.user?.name ?? null, a.user?.avatar_url ?? null);
    if (a.award_type === "custom") s.custom_awards_count += 1;
    else s.mvp_count += 1;
  }

  for (const s of map.values()) {
    s.win_rate = s.played === 0 ? 0 : s.wins / s.played;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.played !== a.played) return b.played - a.played;
    return b.win_rate - a.win_rate;
  });
}
