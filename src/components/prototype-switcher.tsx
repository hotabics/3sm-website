"use client";

// PROTOTIPS — izmetams. Peldošā josla variantu pārslēgšanai (?variant=).
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  variants: { key: string; name: string }[];
  current: string;
};

export function PrototypeSwitcher({ variants, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const idx = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  );

  function go(delta: number) {
    const next = variants[(idx + delta + variants.length) % variants.length];
    const sp = new URLSearchParams(params.toString());
    sp.set("variant", next.key);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const v = variants[idx];
  return (
    <div className="fixed bottom-3 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-yellow-300 bg-yellow-300 p-1 font-mono text-xs text-black shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
      <button
        onClick={() => go(-1)}
        aria-label="Iepriekšējais variants"
        className="h-8 w-8 rounded-full bg-black/10 hover:bg-black/20"
      >
        ←
      </button>
      <span className="whitespace-nowrap px-2 font-bold">
        {v.key} · {v.name}
      </span>
      <button
        onClick={() => go(1)}
        aria-label="Nākamais variants"
        className="h-8 w-8 rounded-full bg-black/10 hover:bg-black/20"
      >
        →
      </button>
    </div>
  );
}
