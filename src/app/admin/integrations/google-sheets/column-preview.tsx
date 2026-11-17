"use client";

import { useState, useTransition } from "react";
import {
  previewGoogleSheetColumn,
  type GoogleSheetPreviewRow,
} from "@/app/actions/google-sheets";

type Preview = Extract<Awaited<ReturnType<typeof previewGoogleSheetColumn>>, { ok: true }>;

const stateLabels: Record<GoogleSheetPreviewRow["state"], string> = {
  new: "Jauns pieteikums",
  registered: "Jau pieteikts 3SM",
  cancelled: "Atcelts 3SM — automātiski neatjaunos",
  new_guest: "Tiks pievienots kā neidentificēts Sheets dalībnieks",
  unidentified: "Jau pieteikts kā neidentificēts Sheets dalībnieks",
  duplicate: "Spēlētājs kolonnā atkārtojas",
  needs_payment: "Nepieciešama apmaksa 3SM",
};

export function GoogleSheetColumnPreview({ mapId }: { mapId: string }) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadPreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewGoogleSheetColumn(mapId);
      if (!result.ok) {
        setPreview(null);
        setError(result.error);
        return;
      }
      setPreview(result);
    });
  }

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <button
        type="button"
        onClick={loadPreview}
        disabled={pending}
        className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
      >
        {pending ? "Nolasu kolonnu…" : preview ? "Pārbaudīt vēlreiz" : "Pārbaudīt visu kolonnu"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>}
      {preview && (
        <div className="mt-3 space-y-3 text-xs">
          <p className={preview.canImport && preview.siteOnly.length === 0 && !preview.rows.some((row) => row.siteStatusMismatch) ? "text-green-400" : "text-amber-300"} role="status">
            Atrasti {preview.rows.length} ieraksti
            {" · "}{preview.rows.filter((row) => row.sheetStatus === "confirmed").length} pamatsastāvā
            {" · "}{preview.rows.filter((row) => row.sheetStatus === "queue").length} rezervē.
            {preview.siteOnly.length > 0 && ` ${preview.siteOnly.length} aktīvi 3SM pieteikumi nav šajā Sheets kolonnā.`}
            {preview.rows.some((row) => row.siteStatusMismatch) && " Dažiem spēlētājiem pamatsastāva/rezerves statuss atšķiras."}
            {preview.needsMigration && " Pirms importa jāpiemēro 00011 un 00012 datubāzes migrācija."}
            {!preview.canImport && !preview.needsMigration && " Vispirms jānovērš zemāk norādītās kļūdas."}
          </p>
          {preview.rows.length === 0 ? (
            <p className="text-neutral-500">Šajā kolonnā nav spēlētāju ierakstu.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {preview.rows.map((row) => {
                const blocked = ["duplicate", "needs_payment"].includes(row.state);
                return (
                  <li key={row.cell} className={`rounded-lg border px-3 py-2 ${blocked ? "border-amber-500/40 bg-amber-500/5" : "border-neutral-800"}`}>
                    <span className="font-mono text-neutral-500">{row.cell}</span>
                    {" · "}<span className="font-medium">{row.displayName}</span>
                    {" · "}<span className="text-neutral-400">{row.sheetStatus === "queue" ? "rezerve" : "pamatsastāvs"}</span>
                    <span className={`block pt-1 ${blocked ? "text-amber-300" : "text-neutral-500"}`}>
                      {stateLabels[row.state]}{row.playerName ? ` · ${row.playerName}` : ""}
                    </span>
                    {row.siteStatusMismatch && (
                      <span className="block pt-1 text-amber-300">
                        Statuss atšķiras: 3SM {row.siteStatusMismatch === "confirmed" ? "pamatsastāvā" : "rezervē"}.
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {preview.siteOnly.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-100">
              <p className="font-medium">3SM pieteikumi, kuru tabulas kolonnā nav</p>
              <ul className="mt-2 space-y-1">
                {preview.siteOnly.map((player) => (
                  <li key={player.userId}>
                    {player.displayName} · {player.status === "queue" ? "rezerve" : "pamatsastāvs"}
                    {player.identityStatus === "unidentified" && " · neidentificēts"}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-amber-100/80">
                Tas var būt jauns vietnes pieteikums, kas vēl nav eksportēts, vai tabulā izdzēsts vārds. Pārbaude nevienu neatceļ; ja dzēšana bija apzināta, atcel to 3SM lapā vai ar Apps Script komandu.
              </p>
            </div>
          )}
          {preview.rows.some((row) => row.state === "new_guest" || row.state === "unidentified") && (
            <p className="text-amber-200">
              Neidentificētie dalībnieki būs redzami treniņā, bet nevarēs pieslēgties kā 3SM lietotāji. Ja zini viņu īsto profilu, sasaisti Sheets vārdu <a href="#sheet-aliases" className="underline">augstāk esošajā formā</a>. Pārbaude pati rezervācijas nemaina.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
