"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  defaultName: string;
  defaultPhone: string;
  defaultWhatsapp: string;
};

export function OnboardingForm({
  defaultName,
  defaultPhone,
  defaultWhatsapp,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp);
  const [sameAsPhone, setSameAsPhone] = useState(
    !defaultWhatsapp || defaultWhatsapp === defaultPhone
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesija beigusies — pieslēdzies vēlreiz.");
      setLoading(false);
      return;
    }

    const { error: upsertError } = await supabase.from("users").upsert(
      {
        id: user.id,
        email: user.email!,
        name: name.trim(),
        phone: phone.trim(),
        whatsapp: sameAsPhone ? phone.trim() : whatsapp.trim(),
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      setError(upsertError.message);
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <Field label="Vārds, uzvārds">
        <input
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="Jānis Bērziņš"
        />
      </Field>

      <Field label="Telefons">
        <input
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input"
          placeholder="+371 20000000"
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={sameAsPhone}
          onChange={(e) => setSameAsPhone(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        WhatsApp ir tas pats numurs
      </label>

      {!sameAsPhone && (
        <Field label="WhatsApp numurs">
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="input"
            placeholder="+371 20000000"
          />
        </Field>
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--color-accent)] px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Saglabāju…" : "Turpināt"}
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          background: #171717;
          border: 1px solid #2a2a2a;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          color: #f5f5f5;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: var(--color-accent);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-neutral-300">{label}</span>
      {children}
    </label>
  );
}
