"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelRegistration,
  registerForTraining,
} from "@/app/actions/registrations";
import { Jersey } from "./jersey";
import { PaySheet } from "./pay-sheet";

export type HeroPlayer = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  team: "black" | "white" | "flexible" | null;
  status: "confirmed" | "queue";
};

export type HeroMe = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: "confirmed" | "queue" | null;
  /** Pamatsastāvs ar sezonas maksu → pieteikums uzreiz 'confirmed'. */
  corePaid: boolean;
  paid: boolean;
  /** Swedbank pārskaitījums pieteikts, gaida apstiprinājumu. */
  transferPending: boolean;
};

type Props = {
  trainingId: string;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  closesLabel: string;
  maxPlayers: number;
  /** Var pieteikties/atteikties (status 'open' un vēl nav 17:00). */
  isOpen: boolean;
  trainingStatus: "open" | "closed" | "cancelled" | "completed";
  players: HeroPlayer[];
  /** null — nav ielogojies. */
  me: HeroMe | null;
  priceLabel: string;
  /** Atnāca no ?naku=1 (WhatsApp saite / pēc ielogošanās) — piesakām uzreiz. */
  autoJoin: boolean;
  flash: "paid" | null;
};

type Toast = { text: string; undo?: () => void; tone?: "error" };

const LOGIN_HREF = `/login?next=${encodeURIComponent("/?naku=1")}`;

export function TrainingHero(props: Props) {
  const { me, isOpen, maxPlayers } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mine, setOptimisticMine] = useOptimistic(me?.status ?? null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [paying, setPaying] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRan = useRef(false);

  function showToast(t: Toast) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  function join(opts: { thenCleanUrl?: boolean } = {}) {
    if (!me) return;
    startTransition(async () => {
      setOptimisticMine(me.corePaid ? "confirmed" : "queue");
      const r = await registerForTraining(props.trainingId);
      if (opts.thenCleanUrl) router.replace("/", { scroll: false });
      if (!r.ok) {
        showToast({ text: r.error, tone: "error" });
        return;
      }
      showToast({
        text:
          r.status === "confirmed"
            ? "Tu esi iekšā. Līdz ceturtdienai ⚽"
            : `Pieteikts! Sastāvu fiksēs ${props.closesLabel}.`,
        undo: () => cancel({ silent: true }),
      });
    });
  }

  function cancel({ silent = false } = {}) {
    startTransition(async () => {
      setOptimisticMine(null);
      const r = await cancelRegistration(props.trainingId);
      if (!r.ok) {
        showToast({ text: r.error, tone: "error" });
        return;
      }
      if (silent) setToast(null);
      else showToast({ text: "Pieteikums atcelts.", undo: () => join() });
    });
  }

  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (props.flash === "paid") {
      showToast({ text: "Paldies! Maksājums saņemts." });
      router.replace("/", { scroll: false });
    }
    if (props.autoJoin) {
      if (me && !me.status && isOpen) join({ thenCleanUrl: true });
      else router.replace("/", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sastāva secība: confirmed, tad queue (kā cron to sakārtos) ──
  const others = props.players.filter((p) => p.userId !== me?.userId);
  const list: (HeroPlayer & { isMe?: boolean })[] = [...others];
  if (me && mine) {
    const meEntry = {
      userId: me.userId,
      name: "Tu",
      avatarUrl: me.avatarUrl,
      team: null,
      status: mine,
      isMe: true,
    };
    const original = props.players.findIndex((p) => p.userId === me.userId);
    if (original >= 0) list.splice(original, 0, meEntry);
    else if (mine === "confirmed") {
      const lastConfirmed = list.findLastIndex((p) => p.status === "confirmed");
      list.splice(lastConfirmed + 1, 0, meEntry);
    } else list.push(meEntry);
  }
  const onPitch = list.slice(0, maxPlayers);
  const bench = list.slice(maxPlayers);
  const free = Math.max(0, maxPlayers - onPitch.length);
  const canJoin = isOpen && !mine;
  const myIndex = list.findIndex((p) => p.isMe);
  const iAmOnBench = myIndex >= maxPlayers;

  const showPay =
    !!me && !!mine && !me.corePaid && !me.paid &&
    props.trainingStatus !== "cancelled";

  return (
    <section className="flex flex-col items-center text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-accent)]">
        {props.dayLabel} · {props.timeLabel}
      </p>
      <h1 className="mt-2 text-5xl font-black leading-none tracking-tight sm:text-6xl">
        {props.dateLabel}
      </h1>
      <p className="mt-2 text-neutral-400">{props.location}</p>

      <BigButton
        me={me}
        mine={mine}
        isOpen={isOpen}
        trainingStatus={props.trainingStatus}
        onBench={iAmOnBench}
        pending={pending}
        onJoin={() => join()}
        onCancel={() => cancel()}
      />

      <p className="mt-8 text-sm text-neutral-400" aria-live="polite">
        <strong className="text-white">{onPitch.length}</strong>/{maxPlayers} laukumā
        {free > 0 ? ` · vēl ${free} ${free === 1 ? "vieta" : "vietas"}` : " · nākamie rindā"}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {isOpen
          ? `Pieteikšanās un atteikšanās noslēdzas ${props.closesLabel}`
          : props.trainingStatus === "cancelled"
            ? "Treniņš atcelts"
            : "Sastāvs fiksēts"}
      </p>

      {showPay && (
        <div className="mt-5 text-sm">
          {me!.transferPending ? (
            <p className="text-neutral-500">Pārskaitījums gaida Mūža apstiprinājumu.</p>
          ) : (
            <button
              onClick={() => setPaying(true)}
              className="text-neutral-400 underline decoration-neutral-700 underline-offset-4 hover:text-white"
            >
              Samaksāt {props.priceLabel} tagad
              <span className="text-neutral-600"> · vai vēlāk</span>
            </button>
          )}
        </div>
      )}

      {/* ── Laukums: vietu režģis ── */}
      <div className="mt-10 w-full rounded-2xl border border-green-900/40 bg-[linear-gradient(180deg,#0c1f12,#081409)] p-3 sm:p-5">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          {onPitch.map((p) => (
            <li key={p.userId}>
              {p.isMe ? (
                <button
                  onClick={isOpen ? () => cancel() : undefined}
                  disabled={!isOpen || pending}
                  aria-label={isOpen ? "Tava vieta — pieskaries, lai atteiktos" : "Tava vieta"}
                  className="flex aspect-square w-full flex-col items-center justify-center rounded-xl bg-[var(--color-success)] text-black ring-2 ring-green-300"
                >
                  <span className="text-2xl font-black" aria-hidden>✓</span>
                  <span className="text-xs font-semibold">Tu</span>
                </button>
              ) : (
                <PlayerSlot player={p} />
              )}
            </li>
          ))}
          {Array.from({ length: free }, (_, i) => (
            <li key={`free-${i}`}>
              <FreeSlot
                first={i === 0}
                canJoin={canJoin}
                loggedIn={!!me}
                pending={pending}
                onJoin={() => join()}
              />
            </li>
          ))}
        </ul>
      </div>

      {bench.length > 0 && (
        <div className="mt-4 w-full text-left">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Rindā ({bench.length})
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {bench.map((p) => (
              <li
                key={p.userId}
                className={`rounded-full px-3 py-1 text-sm ${
                  p.isMe ? "bg-yellow-400/20 text-yellow-200" : "bg-neutral-900 text-neutral-300"
                }`}
              >
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div
            className={`flex items-center gap-4 rounded-full px-5 py-3 text-sm font-medium shadow-2xl ${
              toast.tone === "error" ? "bg-red-500 text-white" : "bg-white text-black"
            }`}
          >
            {toast.text}
            {toast.undo && (
              <button
                onClick={() => {
                  const u = toast.undo!;
                  setToast(null);
                  u();
                }}
                className="font-bold text-[var(--color-accent)] hover:underline"
              >
                Atsaukt
              </button>
            )}
          </div>
        </div>
      )}

      {paying && (
        <PaySheet
          trainingId={props.trainingId}
          amountLabel={props.priceLabel}
          dateLabel={props.dateLabel}
          onClose={() => setPaying(false)}
          onTransferNoted={() => {
            setPaying(false);
            showToast({ text: "Paldies! Mūzis atzīmēs, kad redzēs pārskaitījumu." });
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function BigButton({
  me,
  mine,
  isOpen,
  trainingStatus,
  onBench,
  pending,
  onJoin,
  onCancel,
}: {
  me: HeroMe | null;
  mine: "confirmed" | "queue" | null;
  isOpen: boolean;
  trainingStatus: Props["trainingStatus"];
  onBench: boolean;
  pending: boolean;
  onJoin: () => void;
  onCancel: () => void;
}) {
  const base =
    "mt-10 flex h-56 w-56 flex-col items-center justify-center rounded-full text-white transition active:scale-95 sm:h-64 sm:w-64 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white";
  const idle = `${base} bg-[var(--color-accent)] shadow-[0_0_80px_rgba(194,93,194,0.4)] hover:brightness-110`;
  const done = `${base} bg-[var(--color-success)] shadow-[0_0_80px_rgba(34,197,94,0.35)]`;
  const muted = `${base} cursor-default bg-neutral-900 text-neutral-400`;

  if (!me) {
    return (
      <Link href={isOpen ? LOGIN_HREF : "/login"} className={isOpen ? idle : muted}>
        <span className="text-3xl font-black uppercase tracking-wide">
          {isOpen ? "Nāku" : "Ielogoties"}
        </span>
        <span className="mt-1 text-xs opacity-80">ar Google</span>
      </Link>
    );
  }

  if (mine) {
    const playing = mine === "confirmed" && !onBench;
    const title = !isOpen
      ? playing
        ? "Tu spēlē"
        : "Tu esi rindā"
      : onBench
        ? "Rindā"
        : "Esmu iekšā";
    return (
      <button
        onClick={isOpen ? onCancel : undefined}
        disabled={!isOpen || pending}
        aria-pressed="true"
        className={onBench ? `${base} bg-yellow-500 text-black` : done}
      >
        <span className="text-6xl" aria-hidden>✓</span>
        <span className="mt-2 text-2xl font-bold">{title}</span>
        {isOpen && <span className="mt-1 text-xs opacity-80">pieskaries, lai atteiktos</span>}
      </button>
    );
  }

  if (!isOpen) {
    return (
      <div className={muted} aria-disabled="true">
        <span className="text-2xl font-bold">
          {trainingStatus === "cancelled" ? "Atcelts" : "Slēgts"}
        </span>
        <span className="mt-1 text-xs">reģistrācija beigusies</span>
      </div>
    );
  }

  return (
    <button onClick={onJoin} disabled={pending} aria-pressed="false" className={idle}>
      <span className="text-3xl font-black uppercase tracking-wide">Nāku</span>
    </button>
  );
}

function PlayerSlot({ player }: { player: HeroPlayer }) {
  const initials = player.name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="relative flex aspect-square flex-col items-center justify-center rounded-xl bg-neutral-900/80 px-1 text-center">
      {player.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold">
          {initials || "?"}
        </span>
      )}
      <span className="mt-1 w-full truncate text-[11px] text-neutral-300">{player.name}</span>
      <span className="absolute right-1.5 top-1.5">
        <Jersey team={player.team} size={14} />
      </span>
    </div>
  );
}

function FreeSlot({
  first,
  canJoin,
  loggedIn,
  pending,
  onJoin,
}: {
  first: boolean;
  canJoin: boolean;
  loggedIn: boolean;
  pending: boolean;
  onJoin: () => void;
}) {
  const cls = `flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
    canJoin
      ? first
        ? "border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
        : "border-neutral-700 text-neutral-500 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      : "border-neutral-800 text-neutral-700"
  }`;
  const inner = (
    <>
      <span className="text-2xl leading-none" aria-hidden>+</span>
      {canJoin && first && <span className="mt-1 text-[11px] font-semibold">Ieņem</span>}
    </>
  );
  if (!canJoin) {
    return <div className={cls} aria-hidden>{inner}</div>;
  }
  if (!loggedIn) {
    return (
      <Link href={LOGIN_HREF} aria-label="Ieņemt brīvo vietu" className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onJoin} disabled={pending} aria-label="Ieņemt brīvo vietu" className={cls}>
      {inner}
    </button>
  );
}
