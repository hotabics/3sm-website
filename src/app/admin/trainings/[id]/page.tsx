import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import {
  getTrainingById,
  getRegistrationsForTraining,
} from "@/lib/trainings";
import { formatRiga } from "@/lib/time";
import { ManagePlayers } from "./manage-players";
import { CancelTrainingButton } from "./cancel-button";

type Params = { id: string };

export default async function AdminTrainingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  await requireAdmin();
  const { id } = await params;

  const training = await getTrainingById(id);
  if (!training) notFound();

  const registrations = await getRegistrationsForTraining(training.id);

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <Link
          href="/admin/trainings"
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          ← Visi treniņi
        </Link>

        <div>
          <h1 className="text-3xl font-bold capitalize">
            {formatRiga(training.date + "T20:00:00Z", "EEEE, d. MMMM")}
          </h1>
          <p className="mt-1 text-neutral-400">
            {training.start_time.slice(0, 5)}–{training.end_time.slice(0, 5)} ·{" "}
            {training.location} · {training.status}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Reģistrācija slēgsies: {formatRiga(training.registration_closes_at)}
          </p>
        </div>

        <Link
          href={`/admin/trainings/${id}/teams`}
          className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Atvērt komandu sadalītāju →
        </Link>

        <ManagePlayers registrations={registrations} />

        {training.status !== "cancelled" && (
          <CancelTrainingButton trainingId={training.id} />
        )}
      </main>
    </div>
  );
}
