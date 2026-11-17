"use client";

// PROTOTIPS — izmetams. Viss stāvoklis dzīvo atmiņā; nekādu Supabase/Stripe.
// Mērķis: salīdzināt 3 pieteikšanās plūsmas un saskaitīt pieskārienus līdz
// „esmu iekšā".

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrototypeSwitcher } from "@/components/prototype-switcher";

/* ───────────────────────── viltoti dati ───────────────────────── */

const TRAINING = {
  day: "Ceturtdiena",
  date: "20. novembris",
  time: "20:00–21:30",
  place: "Olimpiskais centrs",
  closes: "ceturtdien 17:00",
  max: 18,
  price: "8,50 €",
};

const ROSTER = [
  "Hugo", "Mūzis", "Niks", "Kaspars", "Edgars", "Rihards", "Toms",
  "Mārtiņš", "Jānis", "Artis", "Roberts", "Dāvis", "Andris", "Gints",
];

type Persona = "core" | "reserve" | "guest";
type Status = "none" | "confirmed" | "pending";

const PERSONAS: { key: Persona; label: string; hint: string }[] = [
  { key: "core", label: "Pamatsastāvs", hint: "sezona apmaksāta" },
  { key: "reserve", label: "Rezervists", hint: "jāmaksā 8,50 €" },
  { key: "guest", label: "Jauns", hint: "nav ielogojies" },
];

const VARIANTS = [
  { key: "A", name: "Viena poga" },
  { key: "B", name: "Ieņem vietu" },
  { key: "C", name: "No WhatsApp" },
];

/* ─────────────── kopīgā plūsma (stub mutācijas) ─────────────── */

type Sheet = null | "google" | "phone" | "pay" | "swedbank";

function useFlow(persona: Persona, resetKey: string) {
  const [signedIn, setSignedIn] = useState(persona !== "guest");
  const [hasPhone, setHasPhone] = useState(persona !== "guest");
  const [status, setStatus] = useState<Status>("none");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [taps, setTaps] = useState(0);
  const [toast, setToast] = useState<null | { text: string; undo?: () => void }>(null);
  const needsPay = persona !== "core";
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSignedIn(persona !== "guest");
    setHasPhone(persona !== "guest");
    setStatus("none");
    setSheet(null);
    setTaps(0);
    setToast(null);
  }, [persona, resetKey]);

  function tap() {
    setTaps((t) => t + 1);
  }

  function showToast(text: string, undo?: () => void) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  function confirm() {
    setSheet(null);
    setStatus("confirmed");
    showToast("Tu esi iekšā. Līdz ceturtdienai ⚽", () => {
      setStatus("none");
      setToast(null);
    });
  }

  /** Galvenā darbība — „Nāku". Pārējais (login, telefons, maksa) seko
   *  tikai tad, ja tiešām vajag, un pēc tam pieteikums notiek pats. */
  function join() {
    tap();
    if (!signedIn) return setSheet("google");
    if (!hasPhone) return setSheet("phone");
    if (needsPay) return setSheet("pay");
    confirm();
  }

  function googleDone() {
    tap();
    setSignedIn(true);
    setSheet("phone"); // nodoms saglabāts — atgriežamies plūsmā, nevis sākumlapā
  }

  function phoneDone() {
    tap();
    setHasPhone(true);
    if (needsPay) setSheet("pay");
    else confirm();
  }

  function payWallet() {
    tap();
    confirm();
  }

  function paySwedbank() {
    tap();
    setSheet(null);
    setStatus("pending");
    showToast("Vieta rezervēta — Mūzis apstiprinās, kad redzēs pārskaitījumu.");
  }

  function cancel() {
    tap();
    const prev = status;
    setStatus("none");
    showToast("Pieteikums atcelts.", () => {
      setStatus(prev);
      setToast(null);
    });
  }

  const confirmedCount = ROSTER.length + (status === "confirmed" ? 1 : 0);

  return {
    persona, signedIn, hasPhone, status, sheet, taps, toast, needsPay,
    confirmedCount, setSheet, join, googleDone, phoneDone, payWallet,
    paySwedbank, cancel, tap,
  };
}

type Flow = ReturnType<typeof useFlow>;

/* ───────────────────────── saknes komponents ───────────────────────── */

export function PrototypeVariants() {
  const params = useSearchParams();
  const variant = params.get("variant") ?? "A";
  const [persona, setPersona] = useState<Persona>("core");
  const flow = useFlow(persona, variant);

  return (
    <div className="min-h-screen pb-28">
      <FakeHeader signedIn={flow.signedIn} />

      {variant === "A" && <VariantA flow={flow} />}
      {variant === "B" && <VariantB flow={flow} />}
      {variant === "C" && <VariantC flow={flow} />}

      <Sheets flow={flow} />
      <Toast flow={flow} />
      <StatePanel flow={flow} persona={persona} setPersona={setPersona} />
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </div>
  );
}

function FakeHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-neutral-900 bg-black/40">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="inline-block h-7 w-7 rounded bg-[var(--color-accent)]" aria-hidden />
          3SM
        </span>
        <span className="text-sm text-neutral-400">
          {signedIn ? "Jānis" : "Viesis"}
        </span>
      </div>
    </header>
  );
}

/* ─────────────── A · Viena poga ───────────────
   Viss ekrāns ir viena izvēle. Datums lielā burtā, zem tā milzīga apaļa
   poga. Nav apstiprinājuma dialoga — tā vietā 5 s „Atsaukt". */

function VariantA({ flow }: { flow: Flow }) {
  const left = TRAINING.max - flow.confirmedCount;
  const inside = flow.status !== "none";
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-10 text-center sm:pt-16">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-accent)]">
        {TRAINING.day} · {TRAINING.time}
      </p>
      <h1 className="mt-2 text-5xl font-black leading-none tracking-tight sm:text-6xl">
        {TRAINING.date}
      </h1>
      <p className="mt-2 text-neutral-400">{TRAINING.place}</p>

      <button
        onClick={inside ? flow.cancel : flow.join}
        aria-pressed={inside}
        className={`mt-10 flex h-56 w-56 flex-col items-center justify-center rounded-full text-white transition active:scale-95 sm:h-64 sm:w-64 ${
          inside
            ? "bg-[var(--color-success)] shadow-[0_0_80px_rgba(34,197,94,0.35)]"
            : "bg-[var(--color-accent)] shadow-[0_0_80px_rgba(194,93,194,0.4)] hover:brightness-110"
        }`}
      >
        {inside ? (
          <>
            <span className="text-6xl" aria-hidden>✓</span>
            <span className="mt-2 text-2xl font-bold">
              {flow.status === "pending" ? "Rezervēts" : "Esmu iekšā"}
            </span>
            <span className="mt-1 text-xs opacity-80">pieskaries, lai atceltu</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-black uppercase tracking-wide">Nāku</span>
            {flow.needsPay && (
              <span className="mt-1 text-sm opacity-90">{TRAINING.price}</span>
            )}
          </>
        )}
      </button>

      <p className="mt-8 text-sm text-neutral-400">
        <strong className="text-white">{flow.confirmedCount}</strong>/{TRAINING.max} laukumā
        {left > 0 ? ` · vēl ${left} vietas` : " · nākamie rindā"}
      </p>
      <p className="mt-1 text-xs text-neutral-600">Pieteikšanās līdz {TRAINING.closes}</p>

      {inside && (
        <a className="mt-6 text-sm text-[var(--color-accent)] underline-offset-4 hover:underline" href="#">
          + Pievienot kalendāram
        </a>
      )}
    </main>
  );
}

/* ─────────────── B · Ieņem vietu ───────────────
   Laukums kā 18 vietu režģis. Aizņemtās vietas ar iniciāļiem, brīvās —
   svītrotas. Pieskaries jebkurai brīvajai vietai = pieteikums. Redzi, cik
   vietu paliek, un kurš jau nāk — sociālais pierādījums pirms klikšķa. */

function VariantB({ flow }: { flow: Flow }) {
  const mine = flow.status !== "none";
  const slots = Array.from({ length: TRAINING.max }, (_, i) => {
    if (i < ROSTER.length) return { kind: "taken" as const, name: ROSTER[i] };
    if (i === ROSTER.length && mine) return { kind: "me" as const, name: "Tu" };
    return { kind: "free" as const, name: "" };
  });
  const firstFree = slots.findIndex((s) => s.kind === "free");

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-accent)]">
            {TRAINING.day}, {TRAINING.date}
          </p>
          <h1 className="text-2xl font-bold">
            {TRAINING.time} · {TRAINING.place}
          </h1>
        </div>
        <p className="shrink-0 text-right text-sm text-neutral-400">
          <span className="block text-3xl font-black text-white">
            {TRAINING.max - flow.confirmedCount}
          </span>
          brīvas vietas
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-green-900/50 bg-[linear-gradient(180deg,#0c1f12,#081409)] p-3 sm:p-5">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          {slots.map((s, i) => (
            <li key={i}>
              {s.kind === "taken" && (
                <div className="flex aspect-square flex-col items-center justify-center rounded-xl bg-neutral-900/80 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold">
                    {s.name.slice(0, 2)}
                  </span>
                  <span className="mt-1 truncate text-[11px] text-neutral-400">{s.name}</span>
                </div>
              )}
              {s.kind === "me" && (
                <button
                  onClick={flow.cancel}
                  className="flex aspect-square w-full flex-col items-center justify-center rounded-xl bg-[var(--color-success)] text-black ring-2 ring-green-300"
                >
                  <span className="text-2xl font-black">✓</span>
                  <span className="text-[11px] font-semibold">
                    {flow.status === "pending" ? "Rezervēts" : "Tu"}
                  </span>
                </button>
              )}
              {s.kind === "free" && (
                <button
                  onClick={mine ? undefined : flow.join}
                  disabled={mine}
                  aria-label="Ieņemt šo vietu"
                  className={`flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition ${
                    mine
                      ? "border-neutral-800 text-neutral-700"
                      : i === firstFree
                        ? "animate-pulse border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                        : "border-neutral-700 text-neutral-500 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  }`}
                >
                  <span className="text-2xl leading-none">+</span>
                  {!mine && i === firstFree && (
                    <span className="mt-1 text-[11px] font-semibold">Ieņem</span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-center text-sm text-neutral-500">
        {mine
          ? "Tava vieta ir zaļā. Pieskaries tai, ja tomēr nevari."
          : `Pieskaries brīvai vietai${flow.needsPay ? ` · ${TRAINING.price}` : ""}. Līdz ${TRAINING.closes}.`}
      </p>
    </main>
  );
}

/* ─────────────── C · No WhatsApp ───────────────
   Pieteikšanās sākas jau atgādinājumā. Ziņā ir saite ar ?nāku=1 —
   atverot lapu, pieteikums notiek pats (0 klikšķu vietnē), un lapa rāda
   tikai apstiprinājumu ar „Atsaukt". Lapā pašā — Nāku/Nenāku kā aptaujā. */

function VariantC({ flow }: { flow: Flow }) {
  const [opened, setOpened] = useState(false);

  if (!opened) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        <p className="mb-3 text-center text-xs text-neutral-500">
          Simulācija: ceturtdienas rīta atgādinājums WhatsApp
        </p>
        <div className="rounded-2xl bg-[#0b141a] p-4">
          <div className="max-w-[85%] rounded-lg rounded-tl-none bg-[#202c33] p-3 text-sm text-[#e9edef]">
            <p className="font-semibold text-[#53bdeb]">3SM</p>
            <p className="mt-1">
              Šodien 20:00 OC. Laukumā jau {ROSTER.length}/{TRAINING.max} —
              vēl {TRAINING.max - ROSTER.length} vietas.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-[#2a3942] text-center text-[#53bdeb]">
              <button
                onClick={() => {
                  setOpened(true);
                  flow.join();
                }}
                className="bg-[#202c33] py-2 font-medium hover:bg-[#26343d]"
              >
                ✓ Nāku
              </button>
              <button
                onClick={() => {
                  flow.tap();
                  setOpened(true);
                }}
                className="bg-[#202c33] py-2 hover:bg-[#26343d]"
              >
                Atvērt
              </button>
            </div>
            <p className="mt-1 text-right text-[10px] text-[#8696a0]">09:00</p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-neutral-600">
          „Nāku" atver 3sm.lv/?naku=1 → pieteikums notiek pats.
        </p>
      </main>
    );
  }

  const inside = flow.status !== "none";
  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <button
        onClick={() => setOpened(false)}
        className="text-xs text-neutral-500 hover:text-neutral-300"
      >
        ← atpakaļ uz WhatsApp
      </button>

      <h1 className="mt-4 text-3xl font-bold">Šodien 20:00</h1>
      <p className="text-neutral-400">{TRAINING.place} · {flow.confirmedCount}/{TRAINING.max}</p>

      <ul className="mt-6 divide-y divide-neutral-900 rounded-xl border border-neutral-900">
        {inside && (
          <li className="flex items-center gap-3 bg-green-500/10 px-4 py-2.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="font-semibold">Tu</span>
            <span className="ml-auto text-xs text-green-400">
              {flow.status === "pending" ? "gaida pārskaitījumu" : "tikko"}
            </span>
          </li>
        )}
        {ROSTER.slice(0, 6).map((n) => (
          <li key={n} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-neutral-600" />
            {n}
          </li>
        ))}
        <li className="px-4 py-2.5 text-xs text-neutral-500">
          + vēl {ROSTER.length - 6}
        </li>
      </ul>

      {/* Lipīgā apakšējā josla — aptaujas stilā */}
      <div className="fixed inset-x-0 bottom-16 z-40 px-4">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-2 backdrop-blur">
          <button
            onClick={inside ? undefined : flow.join}
            className={`rounded-xl py-4 text-lg font-bold transition ${
              inside
                ? "bg-[var(--color-success)] text-black"
                : "bg-[var(--color-accent)] text-white hover:brightness-110"
            }`}
          >
            ✓ Nāku{!inside && flow.needsPay ? ` · ${TRAINING.price}` : ""}
          </button>
          <button
            onClick={inside ? flow.cancel : flow.tap}
            className="rounded-xl border border-neutral-800 py-4 text-lg font-medium text-neutral-300 hover:bg-neutral-900"
          >
            ✕ Nenāku
          </button>
        </div>
      </div>
    </main>
  );
}

/* ─────────────── kopīgās lapas (login / tel. / maksa) ─────────────── */

function Sheets({ flow }: { flow: Flow }) {
  const [phone, setPhone] = useState("+371 ");
  if (!flow.sheet) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={() => flow.setSheet(null)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-neutral-800 bg-neutral-950 p-6 pb-24 sm:rounded-3xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <Steps flow={flow} />

        {flow.sheet === "google" && (
          <>
            <h2 className="text-xl font-bold">Vispirms — kas tu esi?</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Pēc tam pieteikums turpināsies pats — nav jāspiež vēlreiz.
            </p>
            <button
              onClick={flow.googleDone}
              className="mt-5 w-full rounded-xl bg-white py-3.5 font-medium text-black hover:bg-neutral-200"
            >
              Turpināt ar Google
            </button>
          </>
        )}

        {flow.sheet === "phone" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              flow.phoneDone();
            }}
          >
            <h2 className="text-xl font-bold">Sveiks, Jāni! Tikai telefons</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Vārdu paņēmām no Google. Numurs vajadzīgs WhatsApp atgādinājumiem.
            </p>
            <input
              autoFocus
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-4 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3.5 text-lg outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-[var(--color-accent)] py-3.5 font-bold text-white hover:brightness-110"
            >
              {flow.needsPay ? "Tālāk — apmaksa" : "Pieteikties"}
            </button>
          </form>
        )}

        {flow.sheet === "pay" && (
          <>
            <h2 className="text-xl font-bold">{TRAINING.price} par ceturtdienu</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Samaksā — un vieta ir tava. Bez rindas, bez gaidīšanas.
            </p>
            <button
              onClick={flow.payWallet}
              className="mt-5 w-full rounded-xl bg-white py-3.5 text-lg font-semibold text-black hover:bg-neutral-200"
            >
              Apple Pay / Google Pay
            </button>
            <button
              onClick={flow.payWallet}
              className="mt-2 w-full rounded-xl border border-neutral-700 py-3 text-sm text-neutral-200 hover:bg-neutral-900"
            >
              Ar karti (saglabāta: •••• 4242)
            </button>
            <button
              onClick={() => {
                flow.tap();
                flow.setSheet("swedbank");
              }}
              className="mt-3 w-full text-xs text-neutral-500 hover:text-neutral-300"
            >
              Pārskaitīšu ar Swedbank
            </button>
          </>
        )}

        {flow.sheet === "swedbank" && (
          <>
            <h2 className="text-xl font-bold">Pārskaitījums</h2>
            <dl className="mt-4 space-y-2 rounded-xl bg-neutral-900 p-4 text-sm">
              <Row k="Saņēmējs" v="3SM (Mūzis)" />
              <Row k="IBAN" v="LV00 HABA 0000 0000 0000 0" />
              <Row k="Summa" v={TRAINING.price} />
              <Row k="Piezīme" v="3SM 2026-11-20 Jānis" />
            </dl>
            <button
              onClick={flow.paySwedbank}
              className="mt-4 w-full rounded-xl bg-[var(--color-accent)] py-3.5 font-bold text-white hover:brightness-110"
            >
              Rezervēt vietu
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Steps({ flow }: { flow: Flow }) {
  // Rāda, cik soļu VĒL palicis — lai „1-2 un gatavs" ir redzams.
  const steps: { key: Sheet; label: string }[] = [];
  if (flow.persona === "guest") {
    steps.push({ key: "google", label: "Google" }, { key: "phone", label: "Telefons" });
  }
  if (flow.needsPay) steps.push({ key: "pay", label: "Maksa" });
  if (steps.length < 2) return null;
  const current = steps.findIndex(
    (s) => s.key === flow.sheet || (flow.sheet === "swedbank" && s.key === "pay")
  );
  return (
    <ol className="mb-4 flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
              i < current
                ? "bg-[var(--color-success)] text-black"
                : i === current
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-neutral-800 text-neutral-500"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className={i === current ? "text-white" : "text-neutral-500"}>{s.label}</span>
          <span className="text-neutral-700">→</span>
        </li>
      ))}
      <li className="text-neutral-500">Gatavs</li>
    </ol>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  );
}

function Toast({ flow }: { flow: Flow }) {
  if (!flow.toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-36 z-[60] flex justify-center px-4"
    >
      <div className="flex items-center gap-4 rounded-full bg-white px-5 py-3 text-sm font-medium text-black shadow-2xl">
        {flow.toast.text}
        {flow.toast.undo && (
          <button
            onClick={flow.toast.undo}
            className="font-bold text-[var(--color-accent)] hover:underline"
          >
            Atsaukt
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────── prototipa panelis (ne daļa no dizaina) ─────────────── */

function StatePanel({
  flow,
  persona,
  setPersona,
}: {
  flow: Flow;
  persona: Persona;
  setPersona: (p: Persona) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(window.innerWidth >= 900), []);
  return (
    <aside className="fixed right-2 top-16 z-[90] w-56 rounded-xl border-2 border-yellow-300 bg-yellow-300 p-2 font-mono text-[11px] text-black shadow-xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between font-bold"
      >
        PROTOTIPS · pieskārieni: {flow.taps}
        <span>{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            {PERSONAS.map((p) => (
              <label key={p.key} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="persona"
                  checked={persona === p.key}
                  onChange={() => setPersona(p.key)}
                />
                <span>
                  <b>{p.label}</b> — {p.hint}
                </span>
              </label>
            ))}
          </div>
          <pre className="rounded bg-black/10 p-1.5 leading-snug">
{JSON.stringify(
  {
    signedIn: flow.signedIn,
    hasPhone: flow.hasPhone,
    status: flow.status,
    sheet: flow.sheet,
  },
  null,
  1
)}
          </pre>
        </div>
      )}
    </aside>
  );
}
