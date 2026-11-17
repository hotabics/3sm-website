"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMvp, addCustomAward, removeAward } from "@/app/actions/awards";

type Player = {
  user_id: string;
  name: string | null;
};

export type Award = {
  id: string;
  user_id: string;
  user_name: string | null;
  award_type: "mvp_black" | "mvp_white" | "custom";
  label: string | null;
};

export function AwardsPanel({
  trainingId,
  black,
  white,
  awards,
  isAdmin,
}: {
  trainingId: string;
  black: Player[];
  white: Player[];
  awards: Award[];
  isAdmin: boolean;
}) {
  const mvpBlack = awards.find((a) => a.award_type === "mvp_black") ?? null;
  const mvpWhite = awards.find((a) => a.award_type === "mvp_white") ?? null;
  const custom = awards.filter((a) => a.award_type === "custom");

  const allPlayers = [...black, ...white];
  const hasAnyAwards = awards.length > 0;

  if (!isAdmin && !hasAnyAwards) return null;

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6 space-y-5">
      <div>
        <h2 className="font-medium">Apbalvojumi</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Komandu MVP un brīvas formas atzinības par treniņu.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AwardDisplay
          title="MVP Melnā"
          award={mvpBlack}
          accent="black"
        />
        <AwardDisplay
          title="MVP Baltā"
          award={mvpWhite}
          accent="white"
        />
      </div>

      {custom.length > 0 && (
        <ul className="space-y-2">
          {custom.map((a) => (
            <CustomAwardRow key={a.id} award={a} isAdmin={isAdmin} />
          ))}
        </ul>
      )}

      {isAdmin && (
        <AdminControls
          trainingId={trainingId}
          black={black}
          white={white}
          allPlayers={allPlayers}
          mvpBlack={mvpBlack?.user_id ?? null}
          mvpWhite={mvpWhite?.user_id ?? null}
        />
      )}
    </section>
  );
}

function AwardDisplay({
  title,
  award,
  accent,
}: {
  title: string;
  award: Award | null;
  accent: "black" | "white";
}) {
  const cls =
    accent === "black"
      ? "border-neutral-700 bg-black"
      : "border-neutral-300/30 bg-neutral-100/5";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs uppercase tracking-widest text-neutral-400">
        {title}
      </p>
      <p className="mt-1 text-base font-medium">
        {award ? award.user_name ?? "—" : "—"}
      </p>
    </div>
  );
}

function CustomAwardRow({
  award,
  isAdmin,
}: {
  award: Award;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRemove() {
    if (!confirm(`Noņemt apbalvojumu "${award.label}"?`)) return;
    startTransition(async () => {
      const r = await removeAward(award.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate">
          <span className="text-neutral-400">{award.label}</span>
          {" — "}
          <span className="font-medium">{award.user_name ?? "—"}</span>
        </p>
        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          aria-label="Noņemt apbalvojumu"
          className="ml-3 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
        >
          ×
        </button>
      )}
    </li>
  );
}

function AdminControls({
  trainingId,
  black,
  white,
  allPlayers,
  mvpBlack,
  mvpWhite,
}: {
  trainingId: string;
  black: Player[];
  white: Player[];
  allPlayers: Player[];
  mvpBlack: string | null;
  mvpWhite: string | null;
}) {
  return (
    <div className="space-y-4 border-t border-neutral-800 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <MvpPicker
          trainingId={trainingId}
          team="black"
          options={black}
          current={mvpBlack}
        />
        <MvpPicker
          trainingId={trainingId}
          team="white"
          options={white}
          current={mvpWhite}
        />
      </div>
      <CustomAwardForm trainingId={trainingId} options={allPlayers} />
    </div>
  );
}

function MvpPicker({
  trainingId,
  team,
  options,
  current,
}: {
  trainingId: string;
  team: "black" | "white";
  options: Player[];
  current: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(current ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(v: string) {
    setValue(v);
    setError(null);
    const userId = v === "" ? null : v;
    startTransition(async () => {
      const r = await setMvp(trainingId, team, userId);
      if (!r.ok) {
        setError(r.error);
        setValue(current ?? "");
        return;
      }
      router.refresh();
    });
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-widest text-neutral-500">
        MVP {team === "black" ? "Melnā" : "Baltā"}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending || options.length === 0}
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm disabled:opacity-50"
      >
        <option value="">— nav —</option>
        {options.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.name ?? "—"}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function CustomAwardForm({
  trainingId,
  options,
}: {
  trainingId: string;
  options: Player[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId) {
      setError("Izvēlies spēlētāju.");
      return;
    }
    startTransition(async () => {
      const r = await addCustomAward(trainingId, userId, label);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLabel("");
      setUserId("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5">
        <span className="text-xs uppercase tracking-widest text-neutral-500">
          Custom apbalvojums
        </span>
        <input
          type="text"
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Piem. Treniņa pārsteigums"
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-1 min-w-[8rem] flex-col gap-1.5">
        <span className="text-xs uppercase tracking-widest text-neutral-500">
          Spēlētājs
        </span>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="">— izvēlies —</option>
          {options.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.name ?? "—"}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {pending ? "..." : "Pievienot"}
      </button>
      {error && (
        <p className="basis-full text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
