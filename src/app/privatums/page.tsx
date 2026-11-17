import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Privātuma politika — 3SM",
  description: "Kā 3SM vietne apstrādā spēlētāju personas datus.",
};

const LAST_UPDATED = "2026. gada 17. novembris";

export default function PrivatumsPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12 space-y-10">
        <header>
          <p className="text-xs uppercase tracking-widest text-[var(--color-accent)]">
            Privātuma politika
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Kādus datus mēs glabājam un kāpēc
          </h1>
          <p className="mt-3 text-neutral-400">
            3sm.lv ir 3SM amatieru futbola komandas treniņu pieteikšanās
            vietne. Mēs apstrādājam tikai tos datus, kas vajadzīgi, lai
            organizētu treniņus, sadalītu komandas un uzskaitītu maksājumus.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Pēdējās izmaiņas: {LAST_UPDATED}
          </p>
        </header>

        <Section number="1" title="Kādus datus vācam">
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>
              <strong>Konta dati:</strong> e-pasts, vārds un profila bilde —
              no Google konta, ja piesakies ar Google, vai ievadīti pašrocīgi.
            </li>
            <li>
              <strong>Profila dati:</strong> segvārds, tālruņa un WhatsApp
              numurs, ja tos norādi.
            </li>
            <li>
              <strong>Treniņu dati:</strong> pieteikšanās un atcelšanas,
              komandas sadalījums, spēļu rezultāti un balvas.
            </li>
            <li>
              <strong>Maksājumu dati:</strong> maksājuma summa, statuss un
              datums. Kartes datus mēs neredzam un neglabājam — tos apstrādā
              maksājumu pakalpojuma sniedzējs.
            </li>
          </ul>
        </Section>

        <Section number="2" title="Kāpēc tos izmantojam">
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>lai tu varētu pieslēgties un pieteikties treniņiem;</li>
            <li>lai sadalītu komandas un rādītu statistiku;</li>
            <li>lai pieņemtu un, ja vajag, atmaksātu maksājumus;</li>
            <li>
              lai sūtītu paziņojumus par treniņiem (piemēram, WhatsApp vai
              e-pastā).
            </li>
          </ul>
          <p>
            Datus nepārdodam un neizmantojam reklāmai.
          </p>
        </Section>

        <Section number="3" title="Ar ko dalāmies">
          <p>
            Datus apstrādā tikai pakalpojumi, bez kuriem vietne nedarbotos:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>Supabase — datubāze un pieslēgšanās;</li>
            <li>Vercel — vietnes mitināšana;</li>
            <li>Google — pieslēgšanās ar Google un komandas Google Sheets tabula;</li>
            <li>Stripe un Swedbank — maksājumi;</li>
            <li>Twilio — WhatsApp paziņojumi.</li>
          </ul>
          <p>
            Vārds un treniņu dalība ir redzama citiem komandas spēlētājiem.
          </p>
        </Section>

        <Section number="4" title="Google lietotāja dati">
          <p>
            Piesakoties ar Google, mēs saņemam tikai tavu vārdu, e-pastu un
            profila bildi. Tos izmantojam tikai tava 3SM konta izveidei un
            identificēšanai. Mēs nepiekļūstam taviem Google e-pastiem,
            failiem vai citiem datiem.
          </p>
        </Section>

        <Section number="5" title="Cik ilgi glabājam">
          <p>
            Datus glabājam, kamēr tev ir 3SM konts. Maksājumu ierakstus var
            nākties glabāt ilgāk, ja to prasa grāmatvedības noteikumi.
          </p>
        </Section>

        <Section number="6" title="Tavas tiesības">
          <p>
            Tu vari jebkurā laikā lūgt apskatīt, labot vai dzēst savus datus.
            Profila datus vari labot pats{" "}
            <Link
              href="/profile"
              className="text-[var(--color-accent)] hover:underline"
            >
              profilā
            </Link>
            ; par pārējo — raksti komandas administratoram.
          </p>
        </Section>

        <footer className="border-t border-neutral-900 pt-8 text-sm text-neutral-500">
          <Link
            href="/noteikumi"
            className="inline-block text-[var(--color-accent)] hover:underline"
          >
            Komandas noteikumi
          </Link>
          <span className="mx-2">·</span>
          <Link
            href="/"
            className="inline-block text-[var(--color-accent)] hover:underline"
          >
            ← Sākums
          </Link>
        </footer>
      </main>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-3 text-2xl font-bold">
        <span className="font-mono text-base text-[var(--color-accent)]">§{number}</span>
        {title}
      </h2>
      <div className="space-y-3 leading-relaxed text-neutral-300">{children}</div>
    </section>
  );
}
