"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") ? "Pieslēgšanās neizdevās. Mēģini vēlreiz." : null
  );

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const next = params.get("next") ?? "/";
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-8 text-center">
      <div className="space-y-3">
        <h1 className="text-5xl font-bold tracking-tight">3SM</h1>
        <p className="text-neutral-400">
          Ieej ar Google, lai piedalītos ceturtdienas treniņos.
        </p>
      </div>

      <button
        onClick={signIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
      >
        <GoogleIcon />
        {loading ? "Pārvirzu…" : "Turpināt ar Google"}
      </button>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-neutral-500">
        Pieslēdzoties tu piekrīti komandas iekšējiem noteikumiem.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
