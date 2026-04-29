"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  registerForTraining,
  cancelRegistration,
} from "@/app/actions/registrations";
import { startReservePayment } from "@/app/actions/payments";
import { ConfirmDialog } from "./confirm-dialog";

type Props = {
  trainingId: string;
  myStatus: "confirmed" | "queue" | null;
  disabled: boolean;
};

export function RegisterButton({ trainingId, myStatus, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [paying, setPaying] = useState(false);

  function startRegister() {
    setError(null);
    startTransition(async () => {
      const result = await registerForTraining(trainingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.needsPayment) {
        setPaying(true);
        return;
      }
      router.refresh();
    });
  }

  function doCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelRegistration(trainingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onClick() {
    if (myStatus) {
      setConfirmingCancel(true);
    } else {
      startRegister();
    }
  }

  if (disabled && !myStatus) {
    return <p className="text-sm text-neutral-500">Reģistrācija slēgta.</p>;
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

      {confirmingCancel && (
        <ConfirmDialog
          title="Atcelt pieteikumu?"
          body="Vai tiešām vēlies atcelt savu pieteikumu uz šo treniņu? Vari pieteikties atpakaļ līdz pl. 17:00."
          confirmLabel="Jā, atcelt"
          onConfirm={() => {
            setConfirmingCancel(false);
            doCancel();
          }}
          onCancel={() => setConfirmingCancel(false)}
        />
      )}

      {paying && (
        <PaymentChoice
          trainingId={trainingId}
          onClose={() => setPaying(false)}
          onSwedbankConfirmed={() => {
            setPaying(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PaymentChoice({
  trainingId,
  onClose,
  onSwedbankConfirmed,
}: {
  trainingId: string;
  onClose: () => void;
  onSwedbankConfirmed: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSwedbank, setShowSwedbank] = useState(false);

  function payCard() {
    setError(null);
    startTransition(async () => {
      const result = await startReservePayment(trainingId, "stripe");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    });
  }

  function paySwedbank() {
    setError(null);
    startTransition(async () => {
      const result = await startReservePayment(trainingId, "manual_swedbank");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSwedbankConfirmed();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold">Maksā 8.50 EUR par treniņu</h3>
        <p className="mt-2 text-sm text-neutral-400">
          Kā rezervists vai pamatsastāva spēlētājs ar nokavētu sezonas maksu —
          šis treniņš jāapmaksā atsevišķi. Izvēlies veidu:
        </p>

        {!showSwedbank ? (
          <div className="mt-5 space-y-3">
            <button
              onClick={payCard}
              disabled={pending}
              className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "..." : "Maksāt ar karti (Stripe)"}
            </button>
            <button
              onClick={() => setShowSwedbank(true)}
              disabled={pending}
              className="w-full rounded-lg border border-neutral-700 px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
            >
              Pārskaitīt uz Swedbank
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3 text-sm text-neutral-300">
            <p>
              Pārskaiti <strong>8.50 EUR</strong> ar piezīmi:
            </p>
            <code className="block rounded-lg bg-neutral-900 px-3 py-2 text-xs">
              3SM treniņš · {new Date().toISOString().slice(0, 10)}
            </code>
            <p className="text-neutral-500">
              Saņēmējs un IBAN: jautā Mūzim WhatsApp grupā vai admin
              panelī. Pēc nospiešanas tu būsi rindā ar statusu „gaida
              apstiprinājumu" — Mūzis to apstiprinās, kad redzēs pārskaitījumu.
            </p>
            <button
              onClick={paySwedbank}
              disabled={pending}
              className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "..." : "Apstiprinu, pārskaitīšu Swedbank"}
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
          className="mt-4 w-full text-xs text-neutral-500 hover:text-neutral-300"
        >
          Atcelt
        </button>
      </div>
    </div>
  );
}
