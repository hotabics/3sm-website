"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaySheet } from "@/components/pay-sheet";

export function PayDebtButton({
  trainingId,
  amountLabel,
  dateLabel,
}: {
  trainingId: string;
  amountLabel: string;
  dateLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        Samaksāt
      </button>
      {open && (
        <PaySheet
          trainingId={trainingId}
          amountLabel={amountLabel}
          dateLabel={dateLabel}
          onClose={() => setOpen(false)}
          onTransferNoted={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
