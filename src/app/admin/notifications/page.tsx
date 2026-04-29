import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { formatRiga } from "@/lib/time";

type Row = {
  id: string;
  type: string;
  channel: "whatsapp_group" | "whatsapp_personal" | "email";
  message: string;
  status: "pending" | "sent" | "failed";
  sent_at: string | null;
  error: string | null;
  created_at: string;
  user: { name: string | null; nickname: string | null; email: string } | null;
};

export default async function AdminNotificationsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select(
      `id, type, channel, message, status, sent_at, error, created_at,
       user:users(name, nickname, email)`
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = ((data ?? []) as unknown) as Row[];
  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold">Paziņojumi</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Pēdējie 60 ieraksti · {sent} nosūtīti · {failed} neizdevās
            </p>
          </div>
          <Link
            href="/admin/trainings"
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            Treniņi →
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6 text-sm text-neutral-500">
            Vēl nav neviena paziņojuma.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {r.type}{" "}
                      <span className="text-neutral-500">· {r.channel}</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      {r.user
                        ? r.user.nickname?.trim() ||
                          r.user.name ||
                          r.user.email
                        : "(grupa)"}{" "}
                      · {formatRiga(r.created_at, "yyyy-MM-dd HH:mm")}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">
                  {r.message}
                </p>
                {r.error && (
                  <p className="mt-2 text-xs text-red-400">⚠ {r.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map = {
    pending: "bg-yellow-500/20 text-yellow-300",
    sent: "bg-green-500/20 text-green-300",
    failed: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs ${map[status]}`}>
      {status}
    </span>
  );
}
