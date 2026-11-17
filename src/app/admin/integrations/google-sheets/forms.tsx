"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGoogleSheetPlayerAlias,
  saveGoogleSheetTrainingMap,
} from "@/app/actions/google-sheets";

type Training = { id: string; date: string; label: string };
type User = { id: string; label: string };

export function GoogleSheetTrainingMapForm({
  trainings,
  spreadsheetId,
}: {
  trainings: Training[];
  spreadsheetId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [column, setColumn] = useState("");

  function selectTraining(trainingId: string) {
    const date = trainings.find((training) => training.id === trainingId)?.date;
    const octoberColumn: Record<string, string> = {
      "2026-10-01": "B",
      "2026-10-08": "C",
      "2026-10-15": "D",
      "2026-10-22": "E",
      "2026-10-29": "F",
    };
    setColumn(date ? octoberColumn[date] ?? "" : "");
  }

  function submit(form: HTMLFormElement) {
    setError(null);
    setSuccess(null);
    const data = new FormData(form);
    startTransition(async () => {
      const result = await saveGoogleSheetTrainingMap(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Treniņš piesaistīts. Tiks izveidots pirmais sinhronizācijas momentuzņēmums.");
      router.refresh();
    });
  }

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
    >
      <label className="text-sm text-neutral-300">
        3SM treniņš
        <select name="training_id" required disabled={trainings.length === 0} onChange={(event) => selectTraining(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-white disabled:opacity-60">
          <option value="">{trainings.length === 0 ? "Vispirms izveido treniņu" : "Izvēlies…"}</option>
          {trainings.map((training) => (
            <option key={training.id} value={training.id}>
              {training.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-neutral-300">
        Sheets ID
        <input name="spreadsheet_id" required defaultValue={spreadsheetId} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-white" />
      </label>
      <label className="text-sm text-neutral-300">
        Cilnes nosaukums
        <input name="sheet_name" required defaultValue="Oktobris 26" className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-white" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-neutral-300">
          Cilnes GID
          <input name="sheet_gid" required type="number" defaultValue="1591896481" className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-white" />
        </label>
        <label className="text-sm text-neutral-300">
          Datuma kolonna
          <input name="column" required maxLength={3} placeholder="B" value={column} onChange={(event) => setColumn(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 uppercase text-white" />
        </label>
      </div>
      <button disabled={pending || trainings.length === 0} className="self-end rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Saglabāju…" : "Piesaistīt testam"}
      </button>
      {(error || success) && (
        <p className={`sm:col-span-2 text-sm ${error ? "text-red-400" : "text-green-400"}`} role={error ? "alert" : "status"}>
          {error ?? success}
        </p>
      )}
    </form>
  );
}

export function GoogleSheetAliasForm({ users }: { users: User[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function submit(form: HTMLFormElement) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await addGoogleSheetPlayerAlias(new FormData(form));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      setSuccess("Vārdu varianti saglabāti.");
      router.refresh();
    });
  }

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
    >
      <select name="user_id" required className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white">
        <option value="">3SM spēlētājs…</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{user.label}</option>
        ))}
      </select>
      <label className="text-sm text-neutral-300">
        Vārdi Google Sheets
        <textarea name="display_alias" required rows={3} maxLength={2400} placeholder={"Katru variantu jaunā rindā vai atdali ar komatu\nJānis Mūzis, Mūzis, Muzis"} className="mt-1 w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white" />
      </label>
      <button disabled={pending} className="rounded-lg border border-[var(--color-accent)]/50 px-4 py-2 text-sm text-[var(--color-accent)] disabled:opacity-50">
        {pending ? "…" : "Pievienot variantus"}
      </button>
      {error && <p className="sm:col-span-3 text-sm text-red-400" role="alert">{error}</p>}
      {success && <p className="sm:col-span-3 text-sm text-green-400" role="status">{success}</p>}
    </form>
  );
}
