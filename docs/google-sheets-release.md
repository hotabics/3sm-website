# Google Sheets rezervāciju palaišana

Šī integrācija pašlaik izmanto **tikai testa tabulas kopiju**. Pirms atļaut
rakstīšanu īstajā rezervāciju tabulā, atsevišķi jāizlemj tās piekļuve un
jāpārbauda dublētu pieteikumu, atcelšanas un maksājumu scenāriji.

## Pirms izvietošanas

1. Pārbaudi `git status --short`: izvietošanā nedrīkst nejauši iekļaut lokālas
   rezerves kopijas, `.env.local` vai nepārbaudītas izmaiņas. `.vercelignore`
   izslēdz `.env*`, `backups/` un `supabase/.temp/` no Vercel augšupielādes.
2. Palaid `npm run typecheck`, `npm test` un `npm run build`.
3. Pārbaudi `supabase migration list`: attālajā datubāzē vajadzīgas visas
   migrācijas līdz `00010`, ieskaitot. Pirms `db push` pārskati migrācijas un
   izveido datubāzes rezerves kopiju. Nekad neatzīmē migrāciju kā piemērotu,
   ja tās SQL nav izpildīts.
4. Vercel **Production** iestatījumos pievieno
   `GOOGLE_SHEETS_SYNC_ENABLED=true`, `GOOGLE_SHEETS_TEST_SPREADSHEET_ID`,
   `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY` un
   `GOOGLE_SHEETS_WEBHOOK_SECRET`. Privāto atslēgu ievadi kā šifrētu
   vides mainīgo, vienā rindā ar `\n`; neielīmē to Git, čatā vai žurnālos.
   Esošais `CRON_SECRET` arī ir obligāts cron pieprasījumiem.
5. Google service account piešķir **Editor** pieeju tikai testa kopijai.
   Pārbaudi, ka admina kartējumi norāda uz šo kopiju un pareizo datuma kolonnu.
6. WhatsApp grupas paziņojumi ir atsevišķs ieslēgšanas solis. Kamēr nav
   apstiprināts Twilio Conversations grupas kanāls un ziņu šablons,
   `WHATSAPP_GROUP_MODE` atstāj `disabled`; citādi vajadzīgs arī
   `TWILIO_WHATSAPP_CONVERSATION_SID`. Grupas paziņojumu neesamība neaptur
   Sheets importu.

Vercel Preview videi pašlaik nav konfigurētu mainīgo. Ja vēlas testēt Preview,
tai vispirms jāpiešķir atsevišķa, droša konfigurācija; vienkārši izvietots
Preview bez tās nestrādās. Testa Supabase projektu vēlams turēt atsevišķi no
produkcijas, jo vietne un cron raksta datubāzē.

## Pēc izvietošanas

1. Atver `https://3sm.lv/training/<treniņa-id>` un pārbaudi, vai 8. oktobra
   treniņā ir gan pamatsastāvs, gan rezervisti. Bez 3SM konta importētie
   spēlētāji jāredz ar atzīmi **Neidentificēts**.
2. Admina integrāciju lapā izmanto **Pārbaudīt visu kolonnu**; tai jāparāda
   pilnā B–F datuma kolonna, ignorējot 22. rindu un skaitot rezervistus no
   23. rindas. Pārbaudi arī 3SM pieteikumus bez Sheets ieraksta un atšķirīgos
   pamatsastāva/rezerves statusus. Šis solis tikai lasa datus un neatceļ
   pieteikumus, ja vārds no Sheets ir pazudis.
3. Kad saturs sakrīt, izsauc aizsargāto
   `/api/cron/google-sheets-sync` ar `Authorization: Bearer <CRON_SECRET>`
   vai sagaidi ieplānoto cron. Pārbaudi atbildes `scanErrors`, `failed` un
   `held`; ja tās nav tukšas, nepārej pie īstās tabulas.
4. Testa kopijā pievieno jaunu vārdu konkrētā datuma kolonnā, sagaidi līdz
   10 minūtēm un pārbaudi publisko treniņa lapu. Nezināmam vārdam jāparādās
   kā neidentificētam spēlētājam. Pievienojot apstiprinātu aliasu, tā
   pieteikumam jāpāriet uz īsto profilu bez dublikāta.
5. Pārbaudi vietnes pieteikumu → Sheets virzienu un Apps Script parakstītu
   atcelšanu atsevišķi. Periodiskais pilnas kolonnas scans pats par sevi
   neimportē dzēšanu no Sheets.

Ja produkcijā trūkst Google Sheets mainīgo vai `GOOGLE_SHEETS_SYNC_ENABLED`
nav `true`, sinhronizācija paliek izslēgta; jau importētie pieteikumi datubāzē
var būt redzami, bet jauni Sheets ieraksti automātiski neparādīsies. Gaidošie
eksporta notikumi šajā laikā netiek pazaudēti.
