import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getTrainingById,
  getRegistrationsForTraining,
} from "@/lib/trainings";
import { formatRiga } from "@/lib/time";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { ResultForm } from "./result-form";
import { AwardsPanel, type Award } from "./awards-panel";
import { AdminResultControls } from "./admin-result-controls";
import { ShareButtons } from "./share-buttons";

type Params = { id: string };

export default async function TrainingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const training = await getTrainingById(id);
  if (!training) notFound();

  const registrations = await getRegistrationsForTraining(training.id);
  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const queue = registrations.filter((r) => r.status === "queue");
  const black = confirmed.filter((r) => r.team === "black");
  const white = confirmed.filter((r) => r.team === "white");

  const supabase = await createClient();
  const { data: result } = await supabase
    .from("results")
    .select("id, black_score, white_score, status")
    .eq("training_id", id)
    .maybeSingle();

  const { data: awardsData } = await supabase
    .from("match_awards")
    .select(`id, user_id, award_type, label, user:users(name)`)
    .eq("training_id", id);
  type AwardRow = {
    id: string;
    user_id: string;
    award_type: "mvp_black" | "mvp_white" | "custom";
    label: string | null;
    user: { name: string | null } | null;
  };
  const awards: Award[] = ((awardsData ?? []) as unknown as AwardRow[]).map(
    (a) => ({
      id: a.id,
      user_id: a.user_id,
      user_name: a.user?.name ?? null,
      award_type: a.award_type,
      label: a.label,
    })
  );

  const wasParticipant = confirmed.some((r) => r.user_id === profile.id);
  const isAdmin = profile.role === "admin";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://3sm.lv";
  const shareUrl = `${appUrl}/training/${training.id}`;
  const icsUrl = `/training/${training.id}/calendar.ics`;
  const googleCalendarUrl = buildGoogleCalendarUrl({
    trainingId: training.id,
    date: training.date,
    startTime: training.start_time,
    endTime: training.end_time,
    location: training.location ?? "Olimpiskais centrs",
    appUrl,
  });

  const blackPlayers = black.map((r) => ({
    user_id: r.user_id,
    name: r.user.name,
  }));
  const whitePlayers = white.map((r) => ({
    user_id: r.user_id,
    name: r.user.name,
  }));

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Sākums
        </Link>

        <header className="space-y-3">
          <h1 className="text-3xl font-bold capitalize">
            {formatRiga(training.date + "T20:00:00Z", "EEEE, d. MMMM")}
          </h1>
          <p className="text-neutral-400">
            {training.start_time.slice(0, 5)}–{training.end_time.slice(0, 5)} ·{" "}
            {training.location}
          </p>
          <ShareButtons
            shareUrl={shareUrl}
            googleCalendarUrl={googleCalendarUrl}
            icsUrl={icsUrl}
            shareTitle={`3SM treniņš — ${formatRiga(
              training.date + "T20:00:00Z",
              "EEEE, d. MMMM"
            )}`}
          />
        </header>

        {result && (
          <section
            className={`rounded-2xl border p-6 ${
              result.status === "approved"
                ? "border-green-500/30 bg-green-500/5"
                : "border-yellow-500/30 bg-yellow-500/5"
            }`}
          >
            <p className="text-xs uppercase tracking-widest text-neutral-400">
              Rezultāts
              {result.status === "pending" && " (gaida apstiprinājumu)"}
            </p>
            <p className="mt-2 text-3xl font-bold">
              Melnā {result.black_score} : {result.white_score} Baltā
            </p>

            {isAdmin && result.status === "pending" && (
              <AdminResultControls
                resultId={result.id}
                initialBlack={result.black_score}
                initialWhite={result.white_score}
              />
            )}
          </section>
        )}

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
          <h2 className="font-medium">Pieteikušies ({confirmed.length})</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Dalībnieki redzami arī pirms komandu sadales. Google Sheets dalībnieki bez 3SM konta ir atzīmēti kā neidentificēti.
          </p>
          <TrainingRoster players={confirmed} />
          {queue.length > 0 && (
            <div className="mt-5 border-t border-neutral-800 pt-4">
              <h3 className="text-sm font-medium">Rezervē ({queue.length})</h3>
              <TrainingRoster players={queue} />
            </div>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <TeamCard title="Melnā" players={black} variant="black" />
          <TeamCard title="Baltā" players={white} variant="white" />
        </div>

        {wasParticipant && (!result || result.status === "pending") && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6">
            <h2 className="font-medium">Iesniegt rezultātu</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pēc spēles ievadi galarezultātu — admin to apstiprinās.
            </p>
            <ResultForm
              trainingId={training.id}
              defaultBlack={result?.black_score ?? 0}
              defaultWhite={result?.white_score ?? 0}
            />
          </section>
        )}

        <AwardsPanel
          trainingId={training.id}
          black={blackPlayers}
          white={whitePlayers}
          awards={awards}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  );
}

function TrainingRoster({
  players,
}: {
  players: Awaited<ReturnType<typeof getRegistrationsForTraining>>;
}) {
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {players.map((registration) => (
        <li key={registration.id} className="rounded-lg bg-neutral-900/60 px-3 py-2 text-sm">
          <span className="font-medium">
            {registration.user.nickname?.trim() || registration.user.name || "Spēlētājs"}
          </span>
          {registration.user.identity_status === "unidentified" && (
            <span className="ml-2 text-xs text-amber-300">Neidentificēts · Google Sheets</span>
          )}
          {registration.team && (
            <span className="block text-xs text-neutral-500">
              {registration.team === "black" ? "Melnā komanda" : "Baltā komanda"}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function TeamCard({
  title,
  players,
  variant,
}: {
  title: string;
  players: Awaited<ReturnType<typeof getRegistrationsForTraining>>;
  variant: "black" | "white";
}) {
  const cls =
    variant === "black"
      ? "border-neutral-700 bg-neutral-950"
      : "border-neutral-300/30 bg-neutral-100/5";
  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-400">
        {title} ({players.length})
      </h3>
      {players.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">Vēl nav piešķirti.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {players.map((r) => (
            <li key={r.id} className="text-sm">
              {r.user.nickname?.trim() || r.user.name || "—"}
              {r.user.identity_status === "unidentified" && (
                <span className="ml-2 text-xs text-amber-300">Neidentificēts</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
