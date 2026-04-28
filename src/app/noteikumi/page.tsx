import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Noteikumi — 3SM",
  description: "3SM komandas iekšējie noteikumi.",
};

export default function NoteikumiPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12 space-y-10">
        <header>
          <p className="text-xs uppercase tracking-widest text-[var(--color-accent)]">
            Komandas iekšējie noteikumi
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Spēlē pagalma futbolu, klausi Mūzim.
          </h1>
          <p className="mt-3 text-neutral-400">
            3SM ir amatieru komanda, ne čempionāts. Šie noteikumi nav juridisks
            dokuments — tie ir kopējais saprāts, kas mums ļauj jau vairāk nekā
            desmit gadus tikties ceturtdienas vakaros bez liekas drāmas.
          </p>
        </header>

        <Section number="1" title="Muža vārds ir likums">
          <p>
            Mūzis ir komandas dvēsele un kapteinis ārpus laukuma. Viņš sadala
            komandas, lemj strīdīgos brīžos, fiksē sastāvu un pieņem galēnos
            lēmumus par treniņa norisi.
          </p>
          <p>
            Ja kaut kas neskaidrs — pajautā Mūzim. Ja kaut kas šķiet netaisni —
            pajautā Mūzim. Ja Mūzis ir nolēmis — tas tā arī ir.
          </p>
        </Section>

        <Section number="2" title="Pagalma futbola noteikumi">
          <p>
            Mēs spēlējam pagalma futbolu — vienkārši, godīgi, bez liekiem
            tehnikalitātēm. Konkrēti:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>Nav vārtsarga ārpus soda laukuma kvadrāta.</li>
            <li>Nav <em>offside</em> — spēlē kā gadās.</li>
            <li>
              Nav slide-tackles, gružu un kaut ko, kas var radīt traumu — mēs
              visi rīt ejam uz darbu.
            </li>
            <li>Bumbu ārā — iemet ar rokām vai iesper no sāna. Neviens
              neskatās uz pasaules futbola standartiem.</li>
            <li>Soda situācijas izvērtē uz vietas, nepieciešamības gadījumā
              jautā Mūzim.</li>
            <li>Nav VAR. Nav video atkārtojumu. Spēles laikā nav tiesnešu strīdu.</li>
          </ul>
        </Section>

        <Section number="3" title="Pieteikšanās un atcelšana">
          <p>
            Treniņš notiek katru ceturtdienu plkst. 20:00–21:30. Reģistrācija
            notiek šajā lapā un slēgtā ceturtdienas dienā plkst. 17:00 — pēc
            tam sastāvu vairs nemaina.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>
              Pamatsastāvs ar derīgu sezonas maksājumu reģistrējas uzreiz.
            </li>
            <li>
              Rezervisti reģistrējas rindā un apmaksā 8 EUR par treniņu — vai
              ar karti, vai pārskaitot uz Swedbank.
            </li>
            <li>
              Atcelt vari līdz pl. 17:00. Ja samaksāji un treniņš atcelts —
              nauda atgriežas. Ja samaksāji un nepiedalies bez paziņošanas —
              nauda paliek komandai.
            </li>
          </ul>
        </Section>

        <Section number="4" title="Cieņa, drošība, kopiena">
          <p>
            Mēs spēlējam, lai izlādētos pēc darba, nevis lai uzvarētu par katru
            cenu. Tāpēc:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>
              Pret pretinieku komandu izturamies kā pret savējiem — nākamajā
              nedēļā varbūt ar viņiem būsi vienā kvadrātā.
            </li>
            <li>
              Komandas grupas WhatsApp ir spēlei un loģistikai, ne pārējām
              tēmām.
            </li>
            <li>
              Trauma uz laukuma — apstājamies, palīdzam, vajadzības gadījumā
              izsaucam ātro.
            </li>
            <li>
              Pēc treniņa — handshakes, kopējais foto vai bumbas iemešana
              somā. Bez bezspēka strīdiem.
            </li>
          </ul>
        </Section>

        <Section number="5" title="Komandu sadalījums">
          <p>
            Mūzis sadala spēlētājus Melnajā un Baltajā komandā pēc tam, kad
            sastāvs ir fiksēts. Pamatsastāva spēlētāji ar piesaistītu komandu
            paliek savā krāsā, pārējie tiek sadalīti, lai komandas būtu
            līdzvērtīgas.
          </p>
          <p>
            Ja tev nepatīk, kurā komandā šovakar esi — tu zini, ar ko runāt.
            (Jā: ar Mūzi.)
          </p>
        </Section>

        <Section number="6" title="Šie noteikumi un pats svarīgākais">
          <p>
            Visi šie punkti var tikt mainīti. Tas, kas nemainās, ir pirmais —
            klausi Mūzim un spēlē pagalma futbolu.
          </p>
          <p className="text-neutral-500">
            Ja tev liekas, ka šeit kaut kas pietrūkst, vai gribi piedāvāt
            izmaiņas — pasaki Mūzim, un mēs apspriedīsim treniņa pauzē.
          </p>
        </Section>

        <footer className="border-t border-neutral-900 pt-8 text-sm text-neutral-500">
          <p>
            Pieslēdzoties caur lapu tu apliecini, ka esi izlasījis un piekrīti
            šiem noteikumiem.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-[var(--color-accent)] hover:underline"
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
