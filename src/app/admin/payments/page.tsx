import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { formatRiga } from "@/lib/time";
import { PaymentRow } from "./payment-row";

type Row = {
  id: string;
  amount_cents: number;
  currency: string;
  provider: "stripe" | "manual_swedbank";
  status: "pending" | "paid" | "failed" | "refunded";
  created_at: string;
  paid_at: string | null;
  user: { name: string | null; nickname: string | null; email: string } | null;
  training: { id: string; date: string } | null;
};

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select(
      `id, amount_cents, currency, provider, status, created_at, paid_at,
       user:users(name, nickname, email),
       training:trainings(id, date)`
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = ((data ?? []) as unknown) as Row[];
  const pending = rows.filter((r) => r.status === "pending");
  const others = rows.filter((r) => r.status !== "pending");

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-bold">Maksājumi</h1>
          <Link
            href="/admin/trainings"
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            Treniņi →
          </Link>
        </div>

        <Section
          title={`Gaida apstiprinājumu (${pending.length})`}
          rows={pending}
          emptyText="Nav gaidošu maksājumu."
        />
        <Section
          title="Vēsture"
          rows={others.slice(0, 30)}
          emptyText="Vēsture tukša."
        />
      </main>
    </div>
  );
}

function Section({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Row[];
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6 text-sm text-neutral-500">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {r.user?.nickname?.trim() ||
                        r.user?.name ||
                        r.user?.email ||
                        "—"}
                      <span className="ml-2 text-neutral-500">
                        {(r.amount_cents / 100).toFixed(2)} {r.currency.toUpperCase()}
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      {r.provider === "manual_swedbank" ? "Swedbank" : "Stripe"}
                      {" · "}
                      {r.training
                        ? formatRiga(
                            r.training.date + "T20:00:00Z",
                            "EEEE, d. MMMM"
                          )
                        : "—"}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === "pending" && (
                  <PaymentRow paymentId={r.id} provider={r.provider} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map = {
    pending: "bg-yellow-500/20 text-yellow-300",
    paid: "bg-green-500/20 text-green-300",
    failed: "bg-red-500/20 text-red-300",
    refunded: "bg-neutral-500/20 text-neutral-300",
  } as const;
  const label = {
    pending: "gaida",
    paid: "samaksāts",
    failed: "atcelts",
    refunded: "atmaksāts",
  } as const;
  return (
    <span className={`rounded-full px-3 py-1 text-xs ${map[status]}`}>
      {label[status]}
    </span>
  );
}
