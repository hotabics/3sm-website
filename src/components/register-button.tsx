"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  registerForTraining,
  cancelRegistration,
} from "@/app/actions/registrations";

type Props = {
  trainingId: string;
  myStatus: "confirmed" | "queue" | null;
  disabled: boolean;
};

export function RegisterButton({ trainingId, myStatus, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const action = myStatus
        ? cancelRegistration(trainingId)
        : registerForTraining(trainingId);
      const result = await action;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (disabled && !myStatus) {
    return (
      <p className="text-sm text-neutral-500">Reģistrācija slēgta.</p>
    );
  }

  const label = myStatus
    ? myStatus === "confirmed"
      ? "Atcelt pieteikumu"
      : "Atcelt rindu"
    : "Pieteikties uz treniņu";

  const className = myStatus
    ? "rounded-lg border border-red-500/40 px-5 py-3 font-medium text-red-400 transition hover:bg-red-500/10"
    : "rounded-lg bg-[var(--color-accent)] px-5 py-3 font-medium text-white transition hover:opacity-90";

  return (
    <div className="space-y-2">
      <button
        onClick={onClick}
        disabled={pending}
        className={`${className} disabled:opacity-50`}
      >
        {pending ? "..." : label}
      </button>
      {myStatus === "queue" && (
        <p className="text-xs text-neutral-500">
          Tu esi rindā — gaidi admin apstiprinājumu vai apmaksu.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
