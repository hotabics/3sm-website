import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { formatRiga } from "@/lib/time";
import { ResultRow } from "./result-row";

export default async function AdminResultsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("results")
    .select(
      `id, black_score, white_score, status, created_at,
       training:trainings(id, date),
       submitter:users!results_submitted_by_fkey(name)`
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    black_score: number;
    white_score: number;
    status: "pending" | "approved";
    training: { id: string; date: string } | null;
    submitter: { name: string | null } | null;
  };
  const rows = (pending ?? []) as unknown as Row[];

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-bold">Gaidošie rezultāti</h1>
          <Link
            href="/admin/trainings"
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            Treniņi →
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6 text-sm text-neutral-500">
            Nav gaidošu rezultātu.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/training/${r.training?.id}`}
                      className="capitalize hover:text-[var(--color-accent)]"
                    >
                      {r.training
                        ? formatRiga(r.training.date + "T20:00:00Z", "EEEE, d. MMMM")
                        : "—"}
                    </Link>
                    <span className="text-xs text-neutral-500">
                      Iesniedzis: {r.submitter?.name ?? "—"}
                    </span>
                  </div>
                  <ResultRow
                    resultId={r.id}
                    initialBlack={r.black_score}
                    initialWhite={r.white_score}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
