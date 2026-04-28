import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Jersey } from "@/components/jersey";
import { getCurrentProfile } from "@/lib/auth";
import { computeStats } from "@/lib/stats";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const stats = await computeStats(profile.id);
  const me = stats[0];

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <div className="flex items-start gap-4">
          {profile.fixed_team && profile.fixed_team !== "flexible" && (
            <div className="shrink-0 pt-1">
              <Jersey team={profile.fixed_team} size={56} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold">
              {profile.name ?? "Mans profils"}
              {profile.nickname && (
                <span className="ml-3 text-2xl font-normal text-neutral-400">
                  „{profile.nickname}"
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{profile.email}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Tag>
                {profile.player_type === "core" ? "Pamatsastāvs" : "Rezervists"}
              </Tag>
              {profile.fixed_team && profile.fixed_team !== "flexible" && (
                <Tag>
                  {profile.fixed_team === "black" ? "Melnā" : "Baltā"} komanda
                </Tag>
              )}
              {profile.role === "admin" && <Tag accent>Admin</Tag>}
            </div>
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Mana statistika
          </h2>
          {!me || me.played === 0 ? (
            <p className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6 text-sm text-neutral-500">
              Vēl nav neviena treniņa ar apstiprinātu rezultātu.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Spēles" value={me.played} />
              <Stat label="Uzvaras" value={me.wins} accent="green" />
              <Stat label="Zaudējumi" value={me.losses} accent="red" />
              <Stat
                label="Win%"
                value={`${(me.win_rate * 100).toFixed(0)}%`}
              />
              <Stat label="Melnā" value={me.black_count} />
              <Stat label="Baltā" value={me.white_count} />
              <Stat label="Neizšķirts" value={me.draws} />
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Kontaktinfo
          </h2>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm">
            <p>
              <span className="text-neutral-500">Telefons:</span>{" "}
              {profile.phone ?? "—"}
            </p>
            <p className="mt-1">
              <span className="text-neutral-500">WhatsApp:</span>{" "}
              {profile.whatsapp ?? "—"}
            </p>
            <Link
              href="/onboarding"
              className="mt-3 inline-block text-xs text-[var(--color-accent)] hover:underline"
            >
              Labot →
            </Link>
          </div>
        </section>

        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Sākums
        </Link>
      </main>
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${
        accent
          ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
          : "bg-neutral-800 text-neutral-300"
      }`}
    >
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "green" | "red";
}) {
  const cls =
    accent === "green"
      ? "text-green-400"
      : accent === "red"
      ? "text-red-400"
      : "text-white";
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}
