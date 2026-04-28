import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TrainingCard } from "@/components/training-card";
import { getCurrentProfile } from "@/lib/auth";
import {
  getNextTraining,
  getRegistrationsForTraining,
  getMyRegistration,
} from "@/lib/trainings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [profile, { training, error: trainingError }] = await Promise.all([
    getCurrentProfile(),
    getNextTraining(),
  ]);

  const registrations = training
    ? await getRegistrationsForTraining(training.id)
    : [];

  const myReg =
    training && profile
      ? await getMyRegistration(training.id, profile.id)
      : null;

  const myStatus =
    myReg?.status === "confirmed" || myReg?.status === "queue"
      ? myReg.status
      : null;

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        {trainingError && profile?.role === "admin" && (
          <p className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Kļūda ielādējot treniņu: {trainingError}
          </p>
        )}
        {!training ? (
          <EmptyState isAdmin={profile?.role === "admin"} />
        ) : (
          <TrainingCard
            training={training}
            registrations={registrations}
            profile={profile}
            myStatus={myStatus}
          />
        )}
      </main>
    </div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-8 text-center">
      <h2 className="text-2xl font-bold">Nākamais treniņš vēl nav izveidots</h2>
      <p className="mt-2 text-neutral-400">
        Mūzis pievienos to drīz. Atgriezies vēlāk.
      </p>
      {isAdmin && (
        <Link
          href="/admin/trainings"
          className="mt-6 inline-block rounded-lg bg-[var(--color-accent)] px-5 py-3 font-medium text-white"
        >
          Izveidot treniņu →
        </Link>
      )}
    </div>
  );
}
