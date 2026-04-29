"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveRegistration,
  removeRegistration,
} from "@/app/actions/admin";
import type { RegistrationWithUser } from "@/lib/trainings";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function ManagePlayers({
  registrations,
}: {
  registrations: RegistrationWithUser[];
}) {
  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const queue = registrations.filter((r) => r.status === "queue");
  const cancelled = registrations.filter((r) => r.status === "cancelled");

  return (
    <div className="space-y-6">
      <Section title={`Apstiprināti (${confirmed.length})`} players={confirmed} />
      <Section
        title={`Rinda (${queue.length})`}
        players={queue}
        canApprove
      />
      {cancelled.length > 0 && (
        <Section
          title={`Atteikušies / izslēgti (${cancelled.length})`}
          players={cancelled}
          muted
        />
      )}
    </div>
  );
}

function Section({
  title,
  players,
  canApprove = false,
  muted = false,
}: {
  title: string;
  players: RegistrationWithUser[];
  canApprove?: boolean;
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-neutral-500">
        {title}
      </h2>
      {players.length === 0 ? (
        <p className="text-sm text-neutral-600">Tukšs.</p>
      ) : (
        <ul className="space-y-2">
          {players.map((r) => (
            <PlayerRow
              key={r.id}
              reg={r}
              canApprove={canApprove}
              muted={muted}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PlayerRow({
  reg,
  canApprove,
  muted = false,
}: {
  reg: RegistrationWithUser;
  canApprove: boolean;
  muted?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function action(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  const playerLabel = reg.user.nickname?.trim() || reg.user.name || "—";

  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
        muted ? "bg-neutral-900/20 opacity-60" : "bg-neutral-900/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{playerLabel}</p>
        <p className="text-xs text-neutral-500">
          {reg.user.player_type === "core" ? "Pamatsastāvs" : "Rezervists"}
          {reg.team && ` · ${reg.team === "black" ? "Melnā" : "Baltā"}`}
          {muted && " · izslēgts"}
        </p>
        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {muted ? (
          <button
            onClick={() => action(() => approveRegistration(reg.id))}
            disabled={pending}
            className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-50"
            title="Atjaunot pieteikumu"
          >
            Atjaunot
          </button>
        ) : (
          <>
            {canApprove && (
              <button
                onClick={() => action(() => approveRegistration(reg.id))}
                disabled={pending}
                className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-50"
              >
                Apstiprināt
              </button>
            )}
            <button
              onClick={() => setConfirming(true)}
              disabled={pending}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
            >
              Izslēgt
            </button>
          </>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title="Izslēgt no treniņa?"
          body={`Vai tiešām vēlies izslēgt „${playerLabel}" no šī treniņa? Spēlētājs paliks sarakstā kā atteicies.`}
          confirmLabel="Jā, izslēgt"
          onConfirm={() => {
            setConfirming(false);
            action(() => removeRegistration(reg.id));
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </li>
  );
}

