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
            Spēlē 3SM futbolu. Esam atvērti un draudzīgi. Un galvenais —
            spēlējam godīgi.
          </h1>
          <p className="mt-3 text-neutral-400">
            3SM ir amatieru komanda, nevis tā slavenā komanda no Anglijas
            premjerlīgas. Šie noteikumi nav juridisks dokuments — tas ir
            veselais saprāts + laba atmosfēra, kas mums jau vairāk nekā 12
            gadus ļauj katru ceturtdienu satikties bez liekas drāmas.
          </p>
        </header>

        <Section number="1" title="Mūža vārds ir likums">
          <p>
            Mūzis ir komandas dvēsele un kapteinis ārpus laukuma. Viņš:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>sadala komandas,</li>
            <li>izlemj strīdīgās situācijas,</li>
            <li>fiksē sastāvu,</li>
            <li>pieņem galīgos lēmumus par treniņa norisi.</li>
          </ul>
          <p>
            Ja kaut kas nav skaidrs — pajautā Mūzim.
            <br />
            Ja kaut kas šķiet netaisnīgi — pajautā Mūzim.
            <br />
            Ja Mūzis ir nolēmis — tad tā arī ir.
          </p>
          <p className="text-neutral-500">
            (Jā, sistēma ir vienkārša. Tieši tāpēc tā strādā.)
          </p>
        </Section>

        <Section number="2" title="Pagalma 3SM futbola noteikumi">
          <p>
            Mēs spēlējam pagalma futbolu — vienkārši, godīgi un bez liekām
            sarežģītībām.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>
              Nav vārtsarga ārpus soda laukuma kvadrāta. Kvadrāts gan arī nav,
              bet iedomājamies, ka tas ir.
            </li>
            <li>
              Nav <em>offside</em> — spēlējam, kā sanāk.
            </li>
            <li>
              Nav slīdošo izklupienu un citu bīstamu gājienu — mēs visi rīt
              ejam uz darbu.
            </li>
            <li>
              Ja bumba ārā — iesper no malas. FIFA šeit neskaita punktus.
            </li>
            <li>
              Soda situācijas risinām uz vietas. Ja šaubas — skat. §1 (Mūzis).
            </li>
            <li>
              Nav VAR, nav video atkārtojumu, nav strīdu par “varēja būt”.
            </li>
          </ul>
          <p className="font-medium text-neutral-200">
            Fair play &gt; uzvara. Vienmēr.
          </p>
        </Section>

        <Section number="3" title="Pieteikšanās un atcelšana">
          <p>
            <strong>Treniņš:</strong> katru ceturtdienu 20:00–21:30
            <br />
            <strong>Reģistrācija:</strong> līdz 17:00 tajā pašā dienā
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>
              Pamatsastāvs ar aktīvu sezonas maksājumu piesakās uzreiz.
            </li>
            <li>
              Rezervisti piesakās rindā un maksā 8.50 € (karte vai pārskaitījums
              uz Swedbank).
            </li>
            <li>Vari atcelt līdz 17:00.</li>
            <li>Ja treniņš atcelts — nauda tiek atgriezta.</li>
            <li>
              Ja nepaziņo un neierodies — nauda paliek komandai (kā neliels
              sods par “ghostingu”).
            </li>
          </ul>
        </Section>

        <Section number="4" title="Cieņa, drošība, kopiena">
          <p>
            Mēs spēlējam, lai atslēgtos no darba, nevis lai pierādītu, kurš ir
            nākamais Messi.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>Pretinieks = tavējais (nākamnedēļ var būt tavā komandā).</li>
            <li>
              WhatsApp grupa = futbolam un loģistikai (ne dzīves filozofijai).
            </li>
            <li>
              Ja kāds gūst traumu — spēle apstājas, palīdzam, vajadzības
              gadījumā saucam palīdzību.
            </li>
            <li>
              Pēc spēles — rokas spiediens, smaids, varbūt bilde. Strīdus
              atstājam laukumā.
            </li>
            <li>
              Melnie parasti brauc iedzert kādu alu, ja kas baltie var
              pievienoties.
            </li>
          </ul>
        </Section>

        <Section number="5" title="Komandu sadalījums">
          <p>
            Mūzis sadala spēlētājus Melnajā un Baltajā komandā pēc sastāva
            noslēgšanas.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-accent)]">
            <li>Spēlētāji ar “savu” komandu paliek tajā.</li>
            <li>
              Pārējie tiek sadalīti, lai spēle būtu līdzīga un interesanta.
            </li>
          </ul>
          <p>
            Ja nepatīk komanda…
            <br />
            Tu jau zini, pie kā iet. (Jā — pie Mūža.)
          </p>
        </Section>

        <Section number="6" title="Noteikumi un pats svarīgākais">
          <p>Šos noteikumus var mainīt.</p>
          <p>Tas, kas nemainās:</p>
          <ul className="space-y-1.5 pl-1 text-neutral-200">
            <li>👉 klausi Mūzim</li>
            <li>👉 spēlē godīgi</li>
            <li>👉 izbaudi spēli</li>
          </ul>
          <p className="text-neutral-400">
            Ja ir idejas vai ierosinājumi — saki Mūzim. Apspriedīsim pauzē.
          </p>
        </Section>

        <footer className="border-t border-neutral-900 pt-8 text-sm text-neutral-500">
          <p>
            Piesakoties tu apliecini, ka esi izlasījis, sapratis un piekrīti
            šiem noteikumiem.
            <br />
            Un jā — arī fair play daļai 😉
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
