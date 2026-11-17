"use client";

import { useState, useTransition } from "react";
import { payForTraining } from "@/app/actions/payments";

type Props = {
  trainingId: string;
  amountLabel: string;
  dateLabel: string;
  onClose: () => void;
  /** Swedbank pārskaitījums pieteikts (kartes gadījumā notiek pāradresācija). */
  onTransferNoted: () => void;
};

/** Neobligātā apmaksa par vienu treniņu: karte (Stripe) vai Swedbank. */
export function PaySheet({
  trainingId,
  amountLabel,
  dateLabel,
  onClose,
  onTransferNoted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);

  function pay(method: "stripe" | "manual_swedbank") {
    setError(null);
    startTransition(async () => {
      const r = await payForTraining(trainingId, method);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }
      onTransferNoted();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-neutral-800 bg-neutral-950 p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pay-title" className="text-xl font-bold">
          {amountLabel} · {dateLabel}
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Nav obligāti tagad — vari samaksāt arī pēc treniņa.
        </p>

        {!showTransfer ? (
          <div className="mt-5 space-y-2">
            <button
              onClick={() => pay("stripe")}
              disabled={pending}
              className="w-full rounded-xl bg-white py-3.5 font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {pending ? "…" : "Maksāt ar karti"}
            </button>
            <button
              onClick={() => setShowTransfer(true)}
              disabled={pending}
              className="w-full rounded-xl border border-neutral-700 py-3 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
            >
              Pārskaitīšu ar Swedbank
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3 text-sm text-neutral-300">
            <p>
              Pārskaiti <strong>{amountLabel}</strong> ar piezīmi:
            </p>
            <code className="block rounded-lg bg-neutral-900 px-3 py-2 text-xs">
              3SM treniņš · {dateLabel}
            </code>
            <p className="text-neutral-500">
              Saņēmēju un IBAN pajautā Mūzim WhatsApp grupā. Mūzis atzīmēs
              maksājumu, kad to redzēs.
            </p>
            <button
              onClick={() => pay("manual_swedbank")}
              disabled={pending}
              className="w-full rounded-xl bg-[var(--color-accent)] py-3.5 font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "…" : "Pārskaitīju / pārskaitīšu"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-neutral-500 hover:text-neutral-300"
        >
          Vēlāk
        </button>
      </div>
    </div>
  );
}
