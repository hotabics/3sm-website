"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveResult, updateResult } from "@/app/actions/admin";

export function ResultRow({
  resultId,
  initialBlack,
  initialWhite,
}: {
  resultId: string;
  initialBlack: number;
  initialWhite: number;
}) {
  const router = useRouter();
  const [black, setBlack] = useState(initialBlack);
  const [white, setWhite] = useState(initialWhite);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);

  function setScore(team: "black" | "white", value: number) {
    setEdited(true);
    if (team === "black") setBlack(value);
    else setWhite(value);
  }

  function approve() {
    setError(null);
    startTransition(async () => {
      if (edited) {
        const u = await updateResult(resultId, black, white);
        if (!u.ok) {
          setError(u.error);
          return;
        }
      }
      const a = await approveResult(resultId);
      if (!a.ok) {
        setError(a.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <Score label="Melnā" value={black} onChange={(v) => setScore("black", v)} />
      <span className="text-xl font-bold text-neutral-500">:</span>
      <Score label="Baltā" value={white} onChange={(v) => setScore("white", v)} />
      <button
        onClick={approve}
        disabled={pending}
        className="rounded-lg bg-green-500/20 px-4 py-2 text-sm font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-50"
      >
        {pending ? "..." : edited ? "Labot un apstiprināt" : "Apstiprināt"}
      </button>
      {error && (
        <p className="basis-full text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Score({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <input
        type="number"
        min={0}
        max={99}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-20 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-center text-2xl font-bold text-white"
      />
    </label>
  );
}
