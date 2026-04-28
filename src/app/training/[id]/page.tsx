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
import { ResultForm } from "./result-form";

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
  const black = confirmed.filter((r) => r.team === "black");
  const white = confirmed.filter((r) => r.team === "white");

  const supabase = await createClient();
  const { data: result } = await supabase
    .from("results")
    .select("id, black_score, white_score, status")
    .eq("training_id", id)
    .maybeSingle();

  const wasParticipant = confirmed.some((r) => r.user_id === profile.id);

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Sākums
        </Link>

        <header>
          <h1 className="text-3xl font-bold capitalize">
            {formatRiga(training.date + "T20:00:00Z", "EEEE, d. MMMM")}
          </h1>
          <p className="mt-1 text-neutral-400">
            {training.start_time.slice(0, 5)}–{training.end_time.slice(0, 5)} ·{" "}
            {training.location}
          </p>
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
          </section>
        )}

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
      </main>
    </div>
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
              {r.user.name ?? "—"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
