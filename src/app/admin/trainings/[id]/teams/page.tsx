import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import {
  getTrainingById,
  getRegistrationsForTraining,
} from "@/lib/trainings";
import { formatRiga } from "@/lib/time";
import { TeamsBoard } from "./teams-board";

type Params = { id: string };

export default async function TeamsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  await requireAdmin();
  const { id } = await params;

  const training = await getTrainingById(id);
  if (!training) notFound();

  const registrations = await getRegistrationsForTraining(training.id);
  const confirmed = registrations.filter((r) => r.status === "confirmed");

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
        <Link
          href={`/admin/trainings/${id}`}
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          ← Atpakaļ uz treniņu
        </Link>

        <header>
          <h1 className="text-3xl font-bold capitalize">
            Komandas — {formatRiga(training.date + "T20:00:00Z", "EEEE, d. MMMM")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Pārvelc spēlētājus uz Melno vai Balto kolonnu. Saglabāšana
            notiek automātiski.
          </p>
        </header>

        <TeamsBoard initialPlayers={confirmed} />
      </main>
    </div>
  );
}
