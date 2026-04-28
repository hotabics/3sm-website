import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { computeStats } from "@/lib/stats";

export default async function StatsPage() {
  const stats = await computeStats();

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Statistika</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Visi treniņi ar apstiprinātu rezultātu.
          </p>
        </div>

        {stats.length === 0 ? (
          <p className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6 text-sm text-neutral-500">
            Vēl nav apstiprinātu rezultātu.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950/50">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-xs uppercase tracking-widest text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left">Spēlētājs</th>
                  <th className="px-3 py-3 text-right">Sp.</th>
                  <th className="px-3 py-3 text-right">U</th>
                  <th className="px-3 py-3 text-right">N</th>
                  <th className="px-3 py-3 text-right">Z</th>
                  <th className="px-3 py-3 text-right">M/B</th>
                  <th className="px-4 py-3 text-right">Win%</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr
                    key={s.user_id}
                    className="border-b border-neutral-900 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{s.name ?? "—"}</td>
                    <td className="px-3 py-3 text-right text-neutral-300">
                      {s.played}
                    </td>
                    <td className="px-3 py-3 text-right text-green-400">
                      {s.wins}
                    </td>
                    <td className="px-3 py-3 text-right text-neutral-400">
                      {s.draws}
                    </td>
                    <td className="px-3 py-3 text-right text-red-400">
                      {s.losses}
                    </td>
                    <td className="px-3 py-3 text-right text-neutral-400">
                      {s.black_count}/{s.white_count}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {(s.win_rate * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-neutral-600">
          Sp. = spēles · U = uzvaras · N = neizšķirti · Z = zaudējumi ·
          M/B = melnās/baltās komandas · Win% = uzvaru procents.
        </p>

        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Sākums
        </Link>
      </main>
    </div>
  );
}
