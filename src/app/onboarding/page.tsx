import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, phone, whatsapp")
    .eq("id", user.id)
    .single();

  const defaultName =
    profile?.name ??
    (user.user_metadata?.full_name as string | undefined) ??
    "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-bold">Sveiks 3SM!</h1>
        <p className="text-neutral-400">
          Pirms turpini, aizpildi savu profilu — Mūzim vajag, kā ar tevi
          sazināties pirms treniņa.
        </p>
      </div>
      <OnboardingForm
        defaultName={defaultName}
        defaultPhone={profile?.phone ?? ""}
        defaultWhatsapp={profile?.whatsapp ?? ""}
      />
    </main>
  );
}
