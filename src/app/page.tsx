import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TrainingHero, type HeroPlayer } from "@/components/training-hero";
import { displayName, getCurrentProfile } from "@/lib/auth";
import { getMyDebts, isCorePaid } from "@/lib/debts";
import { formatEur } from "@/lib/money";
import { SINGLE_TRAINING_PRICE_CENTS } from "@/lib/stripe";
import { formatRiga } from "@/lib/time";
import {
  getNextTraining,
  getRegistrationsForTraining,
  getMyRegistration,
} from "@/lib/trainings";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ naku?: string; paid?: string }>;
}) {
  const sp = await searchParams;
  const [profile, { training, error: trainingError }] = await Promise.all([
    getCurrentProfile(),
    getNextTraining(),
  ]);

  const [registrations, myReg, debts] = await Promise.all([
    training ? getRegistrationsForTraining(training.id) : Promise.resolve([]),
    training && profile
      ? getMyRegistration(training.id, profile.id)
      : Promise.resolve(null),
    profile ? getMyDebts(profile.id) : Promise.resolve([]),
  ]);

  const openDebts = debts.filter((d) => !d.pendingTransfer);
  const debtTotal = openDebts.reduce((s, d) => s + d.amountCents, 0);

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        {trainingError && profile?.role === "admin" && (
          <p className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Kļūda ielādējot treniņu: {trainingError}
          </p>
        )}

        {debtTotal > 0 && (
          <Link
            href="/profile#maksajumi"
            className="mb-8 flex items-center justify-between gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100 hover:bg-yellow-500/15"
          >
            <span>
              Neapmaksāti treniņi: <strong>{formatEur(debtTotal)}</strong>
              <span className="text-yellow-200/60"> ({openDebts.length})</span>
            </span>
            <span className="font-semibold">Nomaksāt →</span>
          </Link>
        )}

        {!training ? (
          <EmptyState isAdmin={profile?.role === "admin"} />
        ) : (
          <TrainingHero
            trainingId={training.id}
            dayLabel={formatRiga(training.date + "T12:00:00Z", "cccc")}
            dateLabel={formatRiga(training.date + "T12:00:00Z", "d. LLLL")}
            timeLabel={`${training.start_time.slice(0, 5)}–${training.end_time.slice(0, 5)}`}
            location={training.location}
            closesLabel={formatRiga(training.registration_closes_at, "EEEE HH:mm")}
            maxPlayers={training.max_players}
            isOpen={
              training.status === "open" &&
              new Date(training.registration_closes_at) > new Date()
            }
            trainingStatus={training.status}
            players={registrations
              .filter((r) => r.status !== "cancelled")
              .map(
                (r): HeroPlayer => ({
                  userId: r.user_id,
                  name: displayName(r.user),
                  avatarUrl: r.user.avatar_url,
                  team: r.team ?? r.user.fixed_team,
                  status: r.status as "confirmed" | "queue",
                })
              )}
            me={
              profile
                ? {
                    userId: profile.id,
                    name: displayName(profile),
                    avatarUrl: profile.avatar_url,
                    status: myReg?.status ?? null,
                    corePaid: isCorePaid(profile),
                    paid: myReg?.paymentStatus === "paid",
                    transferPending:
                      myReg?.paymentStatus === "pending" &&
                      myReg.paymentProvider === "manual_swedbank",
                  }
                : null
            }
            priceLabel={formatEur(SINGLE_TRAINING_PRICE_CENTS)}
            autoJoin={sp.naku === "1"}
            flash={sp.paid === "1" ? "paid" : null}
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
