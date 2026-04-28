"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelTraining } from "@/app/actions/admin";

export function CancelTrainingButton({ trainingId }: { trainingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!confirm("Atcelt šo treniņu? Visi pieteikumi tiks paziņoti.")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelTraining(trainingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="border-t border-neutral-900 pt-6">
      <button
        onClick={onClick}
        disabled={pending}
        className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
      >
        {pending ? "..." : "Atcelt treniņu"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
