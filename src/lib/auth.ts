import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  nickname: string | null;
  phone: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
  role: "player" | "admin";
  player_type: "core" | "reserve";
  fixed_team: "black" | "white" | "flexible" | null;
  semester_paid_until: string | null;
};

/** Iesauka, ja ir, citādi vārds. */
export function displayName(p: {
  name: string | null;
  nickname: string | null;
}): string {
  return p.nickname?.trim() || p.name?.trim() || "—";
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select(
      "id, email, name, nickname, phone, whatsapp, avatar_url, role, player_type, fixed_team, semester_paid_until"
    )
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  return profile;
}
