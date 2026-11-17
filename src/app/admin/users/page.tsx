import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { UserRow } from "./user-row";

export type UserRowData = {
  id: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  role: "player" | "admin";
  player_type: "core" | "reserve";
  fixed_team: "black" | "white" | "flexible" | null;
  semester_paid_until: string | null;
  identity_status: "identified" | "unidentified";
};

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("users")
    .select(
      "id, email, name, nickname, role, player_type, fixed_team, semester_paid_until, identity_status"
    )
    .order("name", { ascending: true });

  const users = (data ?? []) as UserRowData[];
  const unidentifiedCount = users.filter((user) => user.identity_status === "unidentified").length;

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold">Spēlētāji</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {users.length - unidentifiedCount} ar 3SM kontu · {unidentifiedCount} neidentificēti no Google Sheets.
            </p>
          </div>
          <Link
            href="/admin/trainings"
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            Treniņi →
          </Link>
        </div>

        <ul className="space-y-2">
          {users.map((u) => (
            <UserRow key={u.id} user={u} isMe={u.id === me.id} />
          ))}
        </ul>
      </main>
    </div>
  );
}
