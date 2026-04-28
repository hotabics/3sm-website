import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRiga, isoDateRiga, nextTrainingDate } from "@/lib/time";
import { SiteHeader } from "@/components/site-header";
import { CreateTrainingForm } from "./create-form";

export default async function AdminTrainingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: trainings } = await supabase
    .from("trainings")
    .select("id, date, status, registration_closes_at, max_players")
    .order("date", { ascending: false })
    .limit(20);

  const counts = await Promise.all(
    (trainings ?? []).map(async (t) => {
      const { count: confirmed } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("training_id", t.id)
        .eq("status", "confirmed");
      const { count: queue } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("training_id", t.id)
        .eq("status", "queue");
      return { id: t.id, confirmed: confirmed ?? 0, queue: queue ?? 0 };
    })
  );

  const countsById = Object.fromEntries(counts.map((c) => [c.id, c]));
  const defaultDate = isoDateRiga(nextTrainingDate());

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-10">
        <div>
          <h1 className="text-3xl font-bold">Treniņi</h1>
          <p className="mt-1 text-neutral-400">
            Pārvaldi treniņu sarakstu un sastāvus.
          </p>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6">
          <h2 className="font-medium">Izveidot jaunu treniņu</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Reģistrācija atvērsies 7 dienas iepriekš plkst. 21:30 un slēgsies
            treniņa dienā plkst. 17:00 (Rīgas laiks).
          </p>
          <CreateTrainingForm defaultDate={defaultDate} />
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Visi treniņi</h2>
          {(!trainings || trainings.length === 0) && (
            <p className="text-sm text-neutral-500">Vēl nav izveidots neviens treniņš.</p>
          )}
          <ul className="space-y-2">
            {trainings?.map((t) => {
              const c = countsById[t.id];
              return (
                <li key={t.id}>
                  <Link
                    href={`/admin/trainings/${t.id}`}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/50 px-4 py-3 transition hover:border-[var(--color-accent)]/40"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {formatRiga(t.date + "T20:00:00Z", "EEEE, d. MMMM")}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {t.status} · {c?.confirmed ?? 0}/{t.max_players}{" "}
                        apstiprināti, {c?.queue ?? 0} rindā
                      </p>
                    </div>
                    <span className="text-neutral-500">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
