import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="border-b border-neutral-900 bg-black/40 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="inline-block h-7 w-7 rounded bg-[var(--color-accent)]" aria-hidden />
          3SM
        </Link>

        {profile ? (
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/stats"
              className="hidden text-neutral-400 transition hover:text-white sm:inline"
            >
              Statistika
            </Link>
            <Link
              href="/profile"
              className="text-neutral-400 transition hover:text-white"
            >
              {profile.nickname?.trim() ||
                profile.name?.split(" ")[0] ||
                "Profils"}
            </Link>
            {profile.role === "admin" && (
              <>
                <Link
                  href="/admin/trainings"
                  className="rounded-lg border border-[var(--color-accent)]/40 px-3 py-1.5 text-xs text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/10"
                >
                  Treniņi
                </Link>
                <Link
                  href="/admin/payments"
                  className="hidden rounded-lg border border-[var(--color-accent)]/40 px-3 py-1.5 text-xs text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/10 sm:inline-flex"
                >
                  Maksājumi
                </Link>
              </>
            )}
            <SignOutButton />
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
          >
            Ielogoties
          </Link>
        )}
      </div>
    </header>
  );
}
