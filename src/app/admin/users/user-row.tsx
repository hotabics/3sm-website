"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setUserRole,
  setUserPlayerType,
  setUserFixedTeam,
} from "@/app/actions/admin";
import { Jersey } from "@/components/jersey";
import type { UserRowData } from "./page";

export function UserRow({ user, isMe }: { user: UserRowData; isMe: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  const displayName = user.nickname?.trim() || user.name || user.email;

  return (
    <li className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Jersey team={user.fixed_team} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {displayName}
              {isMe && (
                <span className="ml-2 text-xs text-neutral-500">(tu)</span>
              )}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {user.email}
              {user.semester_paid_until &&
                ` · sezona līdz ${user.semester_paid_until}`}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Pill
          label="Loma"
          value={user.role}
          options={[
            { value: "player", label: "Spēlētājs" },
            { value: "admin", label: "Admin" },
          ]}
          disabled={pending}
          onChange={(v) => run(() => setUserRole(user.id, v as "player" | "admin"))}
        />
        <Pill
          label="Statuss"
          value={user.player_type}
          options={[
            { value: "core", label: "Pamatsastāvs" },
            { value: "reserve", label: "Rezervists" },
          ]}
          disabled={pending}
          onChange={(v) =>
            run(() => setUserPlayerType(user.id, v as "core" | "reserve"))
          }
        />
        <Pill
          label="Komanda"
          value={user.fixed_team ?? "none"}
          options={[
            { value: "none", label: "Nav" },
            { value: "black", label: "Melnā" },
            { value: "white", label: "Baltā" },
            { value: "flexible", label: "Elastīgs" },
          ]}
          disabled={pending}
          onChange={(v) =>
            run(() =>
              setUserFixedTeam(
                user.id,
                v === "none"
                  ? null
                  : (v as "black" | "white" | "flexible")
              )
            )
          }
        />
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function Pill({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg bg-neutral-900/60 px-3 py-2">
      <span className="text-xs uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-white outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
