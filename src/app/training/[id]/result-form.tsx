"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitResult } from "@/app/actions/results";

export function ResultForm({
  trainingId,
  defaultBlack,
  defaultWhite,
}: {
  trainingId: string;
  defaultBlack: number;
  defaultWhite: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [black, setBlack] = useState(defaultBlack);
  const [white, setWhite] = useState(defaultWhite);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitResult(trainingId, black, white);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3">
      <ScoreInput label="Melnā" value={black} onChange={setBlack} />
      <span className="text-2xl font-bold text-neutral-500">:</span>
      <ScoreInput label="Baltā" value={white} onChange={setWhite} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "..." : "Iesniegt"}
      </button>
      {error && (
        <p className="basis-full text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function ScoreInput({
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
