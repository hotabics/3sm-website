"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPaymentPaid, rejectPayment } from "@/app/actions/admin";

export function PaymentRow({
  paymentId,
  provider,
}: {
  paymentId: string;
  provider: "stripe" | "manual_swedbank";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function action(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {provider === "manual_swedbank" && (
        <button
          onClick={() => action(() => markPaymentPaid(paymentId))}
          disabled={pending}
          className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-50"
        >
          Atzīmēt kā samaksātu
        </button>
      )}
      <button
        onClick={() => action(() => rejectPayment(paymentId))}
        disabled={pending}
        className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
      >
        Noraidīt
      </button>
      {error && (
        <p className="basis-full text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
