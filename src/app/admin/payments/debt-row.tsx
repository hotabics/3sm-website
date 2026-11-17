"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markDebtPaid } from "@/app/actions/admin";

export function DebtRow({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await markDebtPaid(registrationId);
            if (!r.ok) setError(r.error);
            router.refresh();
          })
        }
        disabled={pending}
        className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-50"
      >
        {pending ? "…" : "Samaksāja"}
      </button>
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}
