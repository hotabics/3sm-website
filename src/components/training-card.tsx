import Link from "next/link";
import { formatRiga } from "@/lib/time";
import type { Training, RegistrationWithUser } from "@/lib/trainings";
import type { Profile } from "@/lib/auth";
import { RegisterButton } from "./register-button";
import { Jersey } from "./jersey";

type Props = {
  training: Training;
  registrations: RegistrationWithUser[];
  profile: Profile | null;
  myStatus: "confirmed" | "queue" | null;
};

export function TrainingCard({ training, registrations, profile, myStatus }: Props) {
  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const queue = registrations.filter((r) => r.status === "queue");
  const closesAt = formatRiga(training.registration_closes_at, "EEEE HH:mm");
  const isClosed = training.status !== "open";
  const dateLabel = formatRiga(training.date + "T20:00:00Z", "EEEE, d. MMMM");

  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-accent)]">
            Nākamais treniņš
          </p>
          <h2 className="mt-1 text-3xl font-bold capitalize sm:text-4xl">
            {dateLabel}
          </h2>
          <p className="mt-1 text-neutral-400">
            {training.start_time.slice(0, 5)}–{training.end_time.slice(0, 5)} ·{" "}
            {training.location}
          </p>
        </div>
        <Status training={training} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Stat label="Apstiprināti" value={`${confirmed.length}/${training.max_players}`} />
        <Stat label="Rindā" value={String(queue.length)} />
        <Stat label="Reģistrācija slēgs" value={closesAt} />
      </div>

      <div className="mt-6">
        {profile ? (
          <RegisterButton
            trainingId={training.id}
            myStatus={myStatus}
            disabled={isClosed}
          />
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-neutral-200"
          >
            Ielogojies, lai pieteiktos
          </Link>
        )}
      </div>

      <TeamPreview confirmed={confirmed} />

      <PlayerList title="Apstiprināti" players={confirmed} />
      {queue.length > 0 && <PlayerList title="Rindā" players={queue} />}
    </article>
  );
}

function Status({ training }: { training: Training }) {
  const map = {
    open: { label: "Atvērts", className: "bg-green-500/20 text-green-400" },
    closed: { label: "Sastāvs fiksēts", className: "bg-neutral-500/20 text-neutral-300" },
    cancelled: { label: "Atcelts", className: "bg-red-500/20 text-red-400" },
    completed: { label: "Pabeigts", className: "bg-blue-500/20 text-blue-400" },
  } as const;
  const s = map[training.status];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

function TeamPreview({ confirmed }: { confirmed: RegistrationWithUser[] }) {
  // Provizoriskā komandu saspēle: skaita aktuālo `team`, vai, ja vēl nav,
  // spēlētāja `fixed_team`. Elastīgos skaita atsevišķi.
  let black = 0;
  let white = 0;
  let flex = 0;
  for (const r of confirmed) {
    const t = r.team ?? r.user.fixed_team;
    if (t === "black") black++;
    else if (t === "white") white++;
    else flex++;
  }
  if (black === 0 && white === 0 && flex === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-neutral-900 bg-neutral-950 p-3">
      <TeamSlot team="black" count={black} label="Melnā" />
      <div className="flex flex-col items-center justify-center text-xs text-neutral-500">
        <span>Elastīgi</span>
        <span className="text-lg font-bold text-neutral-300">{flex}</span>
      </div>
      <TeamSlot team="white" count={white} label="Baltā" />
    </div>
  );
}

function TeamSlot({
  team,
  count,
  label,
}: {
  team: "black" | "white";
  count: number;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-2 ${
        team === "black" ? "bg-black" : "bg-neutral-100/5"
      }`}
    >
      <Jersey team={team} size={32} />
      <div className="leading-tight">
        <div className="text-xs uppercase tracking-widest text-neutral-400">
          {label}
        </div>
        <div className="text-2xl font-bold">{count}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-900/60 px-4 py-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}

function PlayerList({
  title,
  players,
}: {
  title: string;
  players: RegistrationWithUser[];
}) {
  if (players.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
        {title}
      </h3>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {players.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-lg bg-neutral-900/40 px-3 py-2"
          >
            <Avatar url={r.user.avatar_url} name={r.user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {r.user.nickname?.trim() || r.user.name || "—"}
              </p>
              <p className="text-xs text-neutral-500">
                {r.user.player_type === "core" ? "Pamatsastāvs" : "Rezervists"}
                {r.team && ` · ${r.team === "black" ? "Melnā" : "Baltā"}`}
              </p>
            </div>
            <Jersey team={r.team ?? r.user.fixed_team} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-9 w-9 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium">
      {initials}
    </span>
  );
}
