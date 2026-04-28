import { createClient } from "@/lib/supabase/server";
import { closesAtFor, isoDateRiga, nextTrainingDate, opensAtFor } from "@/lib/time";

export type Training = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  status: "open" | "closed" | "cancelled" | "completed";
  min_players: number;
  max_players: number;
  registration_opens_at: string;
  registration_closes_at: string;
};

export type RegistrationWithUser = {
  id: string;
  user_id: string;
  status: "confirmed" | "queue" | "cancelled";
  team: "black" | "white" | null;
  queue_position: number | null;
  registered_at: string;
  user: {
    name: string | null;
    nickname: string | null;
    avatar_url: string | null;
    player_type: "core" | "reserve";
    fixed_team: "black" | "white" | "flexible" | null;
  };
};

/**
 * Atrod nākamo treniņu — vai nu šīs nedēļas ceturtdiena, vai nākamā.
 */
export async function getNextTraining(): Promise<{
  training: Training | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const todayRiga = isoDateRiga(new Date());

  const { data, error } = await supabase
    .from("trainings")
    .select("*")
    .gte("date", todayRiga)
    .in("status", ["open", "closed"])
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getNextTraining]", error);
    return { training: null, error: error.message };
  }

  return { training: (data as Training) ?? null, error: null };
}

export async function getTrainingById(id: string): Promise<Training | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trainings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as Training | null;
}

export async function getRegistrationsForTraining(
  trainingId: string
): Promise<RegistrationWithUser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select(
      `id, user_id, status, team, queue_position, registered_at,
       user:users(name, nickname, avatar_url, player_type, fixed_team)`
    )
    .eq("training_id", trainingId)
    .neq("status", "cancelled")
    .order("status", { ascending: true })
    .order("registered_at", { ascending: true });

  return (data as unknown as RegistrationWithUser[]) ?? [];
}

export async function getMyRegistration(
  trainingId: string,
  userId: string
): Promise<{ id: string; status: string; team: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select("id, status, team")
    .eq("training_id", trainingId)
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .maybeSingle();
  return data;
}

/**
 * Aprēķina noklusētos laikus jaunam treniņam pēc datuma (Rīgas josla).
 * - Reģistrācija atveras iepriekšējā ceturtdienā 21:30
 * - Aizveras paša treniņa dienā 17:00
 */
export function defaultTrainingTimes(dateIso: string) {
  const trainingDate = new Date(dateIso + "T12:00:00Z"); // pusdienlaiks UTC, lai Rīgas datums sakrīt
  return {
    registration_opens_at: opensAtFor(trainingDate).toISOString(),
    registration_closes_at: closesAtFor(trainingDate).toISOString(),
  };
}

export { nextTrainingDate };
