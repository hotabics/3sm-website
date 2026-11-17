"use client";

import { useState, useTransition } from "react";
import { broadcastTeamAssignments } from "@/app/actions/admin";

type Status =
  | { kind: "idle" }
  | { kind: "ok"; sent: number; skipped: number; missingTeam: number; failed: number }
  | { kind: "error"; error: string };

export function BroadcastButton({ trainingId }: { trainingId: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !confirm(
        "Sūtīt WhatsApp katram apstiprinātam spēlētājam ar viņu komandu un krekla krāsu?"
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await broadcastTeamAssignments(trainingId);
      if (result.ok) {
        setStatus({
          kind: "ok",
          sent: result.sent,
          skipped: result.skipped,
          missingTeam: result.missingTeam,
          failed: result.failed,
        });
      } else {
        setStatus({ kind: "error", error: result.error });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {pending ? "Sūta…" : "Sūtīt komandu paziņojumus"}
      </button>

      {status.kind === "ok" && (
        <p
          className="text-xs text-neutral-400"
          role="status"
          aria-live="polite"
        >
          Nosūtīts: {status.sent} · Izlaisti (jau saņēmuši): {status.skipped}
          {status.missingTeam > 0 && ` · Bez komandas: ${status.missingTeam}`}
          {status.failed > 0 && ` · Kļūdas: ${status.failed}`}
        </p>
      )}
      {status.kind === "error" && (
        <p className="text-xs text-red-400" role="alert">
          {status.error}
        </p>
      )}
    </div>
  );
}
