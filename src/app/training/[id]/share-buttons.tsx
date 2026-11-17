"use client";

import { useState } from "react";

export function ShareButtons({
  shareUrl,
  googleCalendarUrl,
  icsUrl,
  shareTitle,
}: {
  shareUrl: string;
  googleCalendarUrl: string;
  icsUrl: string;
  shareTitle: string;
}) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function onShare() {
    setShareError(null);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      } catch (e) {
        // User cancel — neuztraucamies; cita kļūda — pārkrītam uz copy.
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError("Nevarēja nokopēt saiti.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleCalendarUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs hover:border-neutral-700 hover:text-white"
      >
        Google Calendar
      </a>
      <a
        href={icsUrl}
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs hover:border-neutral-700 hover:text-white"
      >
        Lejupielādēt .ics
      </a>
      <button
        type="button"
        onClick={onShare}
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs hover:border-neutral-700 hover:text-white"
      >
        {copied ? "Saite nokopēta!" : "Dalīties"}
      </button>
      {shareError && (
        <span className="text-xs text-red-400" role="alert">
          {shareError}
        </span>
      )}
    </div>
  );
}
