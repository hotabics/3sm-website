"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTraining } from "@/app/actions/admin";

export function CreateTrainingForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createTraining(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
      <input
        name="date"
        type="date"
        defaultValue={defaultDate}
        required
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white"
      />
      <input
        name="location"
        type="text"
        defaultValue="Olimpiskais centrs"
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white"
        placeholder="Vieta"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "..." : "Izveidot"}
      </button>
      {error && (
        <p className="col-span-full text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
