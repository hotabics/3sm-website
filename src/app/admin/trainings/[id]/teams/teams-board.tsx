"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { setTeam } from "@/app/actions/admin";
import type { RegistrationWithUser } from "@/lib/trainings";

type Lane = "pool" | "black" | "white";

type Player = RegistrationWithUser;

function laneOf(p: Player): Lane {
  if (p.team === "black") return "black";
  if (p.team === "white") return "white";
  return "pool";
}

export function TeamsBoard({
  initialPlayers,
}: {
  initialPlayers: Player[];
}) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function move(playerId: string, lane: Lane) {
    const team = lane === "pool" ? null : lane;
    const previous = players;
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, team } : p))
    );
    startTransition(async () => {
      const result = await setTeam(playerId, team);
      if (!result.ok) {
        setPlayers(previous);
        setError(result.error);
      } else {
        setError(null);
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    move(String(active.id), over.id as Lane);
  }

  const pool = players.filter((p) => laneOf(p) === "pool");
  const black = players.filter((p) => laneOf(p) === "black");
  const white = players.filter((p) => laneOf(p) === "white");

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Column id="pool" title={`Nepiešķirti (${pool.length})`} accent="neutral">
            {pool.map((p) => (
              <PlayerCard key={p.id} player={p} onAssign={move} lane="pool" />
            ))}
          </Column>
          <Column id="black" title={`Melnā (${black.length})`} accent="black">
            {black.map((p) => (
              <PlayerCard key={p.id} player={p} onAssign={move} lane="black" />
            ))}
          </Column>
          <Column id="white" title={`Baltā (${white.length})`} accent="white">
            {white.map((p) => (
              <PlayerCard key={p.id} player={p} onAssign={move} lane="white" />
            ))}
          </Column>
        </div>
      </DndContext>
    </div>
  );
}

function Column({
  id,
  title,
  accent,
  children,
}: {
  id: Lane;
  title: string;
  accent: "neutral" | "black" | "white";
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const accentClass =
    accent === "black"
      ? "border-neutral-700 bg-black"
      : accent === "white"
      ? "border-neutral-300/30 bg-neutral-100/5"
      : "border-neutral-800 bg-neutral-950/50";

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] rounded-2xl border p-3 transition ${accentClass} ${
        isOver ? "ring-2 ring-[var(--color-accent)]" : ""
      }`}
    >
      <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-widest text-neutral-400">
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function PlayerCard({
  player,
  onAssign,
  lane,
}: {
  player: Player;
  onAssign: (playerId: string, lane: Lane) => void;
  lane: Lane;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: player.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 30 }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg bg-neutral-900/80 px-3 py-2 ${
        isDragging ? "opacity-60 shadow-2xl" : ""
      }`}
    >
      <button
        {...listeners}
        {...attributes}
        aria-label={`Pārvilkt ${player.user.name ?? "spēlētāju"}`}
        className="cursor-grab touch-none text-neutral-600 hover:text-neutral-300 active:cursor-grabbing"
      >
        ⋮⋮
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{player.user.name ?? "—"}</p>
        <p className="text-xs text-neutral-500">
          {player.user.player_type === "core" ? "Pamatsastāvs" : "Rezervists"}
        </p>
      </div>

      <QuickAssign current={lane} onAssign={(l) => onAssign(player.id, l)} />
    </li>
  );
}

function QuickAssign({
  current,
  onAssign,
}: {
  current: Lane;
  onAssign: (lane: Lane) => void;
}) {
  const buttons: { lane: Lane; label: string; cls: string }[] = [
    { lane: "pool", label: "—", cls: "bg-neutral-800 text-neutral-400" },
    { lane: "black", label: "M", cls: "bg-neutral-950 text-white border border-neutral-700" },
    { lane: "white", label: "B", cls: "bg-white text-black" },
  ];
  return (
    <div className="flex gap-1">
      {buttons.map((b) => (
        <button
          key={b.lane}
          onClick={() => onAssign(b.lane)}
          aria-label={`Piešķirt: ${b.label}`}
          aria-pressed={current === b.lane}
          className={`h-7 w-7 rounded-md text-xs font-medium transition ${b.cls} ${
            current === b.lane ? "ring-2 ring-[var(--color-accent)]" : "opacity-60 hover:opacity-100"
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
