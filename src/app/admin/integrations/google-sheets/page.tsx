import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { GoogleSheetAliasForm, GoogleSheetTrainingMapForm } from "./forms";
import { GoogleSheetColumnPreview } from "./column-preview";

const TEST_SPREADSHEET_ID = "1N7wveM113ekr_oO1Z0Fhmn0U7N25_BXjny7tdlo-0Mg";
const dateFormatter = new Intl.DateTimeFormat("lv-LV", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Riga",
});

export default async function GoogleSheetsIntegrationPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: trainings, error: trainingsError }, { data: users }, { data: maps }, { data: commands }, { data: aliases, error: aliasesError }] =
    await Promise.all([
      supabase
        .from("trainings")
        .select("id, date, start_time, status")
        .in("status", ["open", "closed"])
        .order("date", { ascending: true })
        .limit(20),
      supabase
        .from("users")
        .select("id, name, nickname, email")
        .eq("identity_status", "identified")
        .order("name", { ascending: true }),
      supabase
        .from("google_sheet_training_maps")
        .select("id, training_id, sheet_name, column_index, enabled, training:trainings(date)")
        .order("created_at", { ascending: false }),
      supabase
        .from("google_sheet_commands")
        .select("id, requested_name, action, status, result, received_at, training:trainings(date)")
        .order("received_at", { ascending: false })
        .limit(12),
      supabase
        .from("google_sheet_player_aliases")
        .select("id, user_id, display_alias")
        .order("display_alias", { ascending: true }),
    ]);

  type Training = { id: string; date: string; start_time: string; status: string };
  type User = { id: string; name: string | null; nickname: string | null; email: string };
  type TrainingRelation = { date: string } | { date: string }[] | null;
  type Map = { id: string; training_id: string; sheet_name: string; column_index: number; enabled: boolean; training: TrainingRelation };
  type Command = { id: string; requested_name: string; action: string; status: string; result: { message?: string } | null; received_at: string; training: TrainingRelation };
  type Alias = { id: string; user_id: string; display_alias: string };

  const trainingOptions = ((trainings ?? []) as Training[]).map((training) => ({
    id: training.id,
    date: training.date,
    label: `${formatSheetDate(training.date)} · ${training.start_time.slice(0, 5)} · ${training.status === "open" ? "atvērts" : "slēgts"}`,
  }));
  const userOptions = ((users ?? []) as User[]).map((user) => ({
    id: user.id,
    label: user.nickname?.trim() || user.name || user.email,
  }));
  const aliasRows = (aliases ?? []) as Alias[];
  const aliasGroups = userOptions
    .map((user) => ({
      ...user,
      names: aliasRows.filter((alias) => alias.user_id === user.id).map((alias) => alias.display_alias),
    }))
    .filter((user) => user.names.length > 0);

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/admin/trainings" className="text-sm text-neutral-500 hover:text-neutral-300">← Treniņi</Link>
        <header>
          <h1 className="text-3xl font-bold">Google Sheets tests</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Testa kopija ir izolēta no īstās tabulas. Katram piesaistītajam datumam skenējam visu kolonnu: 8.–21. rinda ir pamatsastāvs, 22. rinda netiek lasīta, bet no 23. rindas uz leju ir rezerve. Vārds bez 3SM profila tiek parādīts kā neidentificēts Sheets dalībnieks.
          </p>
        </header>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
          <h2 className="font-medium">1. Piesaisti treniņu Sheets kolonnai</h2>
          <p className="mt-1 text-sm text-neutral-500">Esošajai testa lapai “Oktobris 26” B–F kolonnas atbilst datumiem 1., 8., 15., 22. un 29. oktobrī.</p>
          {trainingsError ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              Neizdevās ielādēt treniņus: {trainingsError.message}
            </p>
          ) : trainingOptions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-medium">Izvēlnē nav treniņu, ko piesaistīt.</p>
              <p className="mt-1 text-amber-100/80">
                Datumi Google tabulā neveido treniņus 3SM datubāzē. Izveido oktobra treniņu sadaļā “Treniņi”, tad atgriezies šeit un pārlādē lapu.
              </p>
              <Link href="/admin/trainings?date=2026-10-08" className="mt-3 inline-flex rounded-lg bg-amber-100 px-3 py-2 font-medium text-amber-950 hover:bg-white">
                Atvērt treniņa izveidi →
              </Link>
              <p className="mt-2 text-xs text-amber-100/80">
                8. oktobris būs aizpildīts kā piemērs. Pirms saglabāšanas pārbaudi datumu — izveidots treniņš būs redzams spēlētājiem un mēģinās nosūtīt paziņojumu.
              </p>
            </div>
          ) : null}
          <GoogleSheetTrainingMapForm trainings={trainingOptions} spreadsheetId={process.env.GOOGLE_SHEETS_TEST_SPREADSHEET_ID ?? TEST_SPREADSHEET_ID} />
        </section>

        <section id="sheet-aliases" className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
          <h2 className="font-medium">2. Sasaisti Sheets vārdus ar 3SM profiliem</h2>
          <p className="mt-1 text-sm text-neutral-500">Vienam spēlētājam vari pievienot vairākus pierastus rakstības variantus. Vārdi netiek minēti automātiski — katrs variants ir skaidri jāsasaista, lai nepieļautu pieteikumu cita spēlētāja vārdā.</p>
          <GoogleSheetAliasForm users={userOptions} />
          <div className="mt-6 border-t border-neutral-800 pt-5">
            <h3 className="text-sm font-medium">Esošie vārdu varianti</h3>
            {aliasesError ? (
              <p className="mt-2 text-sm text-red-400" role="alert">Neizdevās ielādēt vārdus: {aliasesError.message}</p>
            ) : aliasGroups.length ? (
              <ul className="mt-3 space-y-3">
                {aliasGroups.map((user) => (
                  <li key={user.id} className="rounded-lg border border-neutral-800 p-3 text-sm">
                    <span className="font-medium">{user.label}</span>
                    <span className="text-neutral-500"> → </span>
                    <span className="text-neutral-300">{user.names.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-neutral-500">Vēl nav pievienotu vārdu variantu.</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">Aktīvie kartējumi</h2>
          {(maps as unknown as Map[] | null)?.length ? (
            <ul className="space-y-2">
              {(maps as unknown as Map[]).map((map) => (
                <li key={map.id} className="rounded-xl border border-neutral-800 px-4 py-3 text-sm">
                  {formatRelationDate(map.training, "Dzēsts treniņš")} → {map.sheet_name}, kolonna {columnLabel(map.column_index)} {map.enabled ? "· aktīvs" : "· izslēgts"}
                  {map.enabled && <GoogleSheetColumnPreview mapId={map.id} />}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-neutral-600">Vēl nav piesaistītu kolonnu.</p>}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">Pēdējās Sheets komandas</h2>
          {(commands as unknown as Command[] | null)?.length ? (
            <ul className="space-y-2">
              {(commands as unknown as Command[]).map((command) => (
                <li key={command.id} className="rounded-xl border border-neutral-800 px-4 py-3 text-sm">
                  <p><span className="font-medium">{command.requested_name}</span> · {command.action} · <span className="text-neutral-400">{command.status}</span></p>
                  <p className="mt-1 text-xs text-neutral-500">{formatRelationDate(command.training, "—")} · {command.result?.message ?? "—"}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-neutral-600">Vēl nav saņemtu komandu.</p>}
        </section>
      </main>
    </div>
  );
}

function columnLabel(columnIndex: number) {
  let value = columnIndex;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function trainingDate(relation: { date: string } | { date: string }[] | null) {
  return Array.isArray(relation) ? relation[0]?.date : relation?.date;
}

function formatSheetDate(date: string) {
  return dateFormatter.format(new Date(date + "T12:00:00Z"));
}

function formatRelationDate(relation: { date: string } | { date: string }[] | null, fallback: string) {
  const date = trainingDate(relation);
  return date ? formatSheetDate(date) : fallback;
}
