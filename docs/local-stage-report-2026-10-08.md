# 3SM lokālā posma atskaite — 2026-10-08

## Paveikts

- Google Sheets kolonnas administratora priekšskatījums tagad rāda abpusējas
  neatbilstības: aktīvus 3SM pieteikumus bez ieraksta tabulā un atšķirīgu
  pamatsastāva/rezerves statusu. Tas ir tikai lasīšanas solis; tukša šūna
  automātiski neatceļ spēlētāju.
- Salīdzināšanas loģikai pievienoti trīs regresijas testi, tostarp tukšas
  kolonnas un jau atcelta pieteikuma scenārijs.
- Iepriekšējā sagatavošanas solī novērsts risks, ka neieslēgta Sheets
  konfigurācija pazaudē gaidošos eksporta notikumus; tie paliek rindā.

## Pārbaudīts lokāli

- `npm run typecheck` — veiksmīgi.
- `npm test` — 11/11 testi veiksmīgi.
- Izolēta `npm run build` — veiksmīgi; neiejaucās darbojošās `next dev`
  būves failos.
- Administratora lapā 8. oktobra testa kolonna rāda 6 ierakstus: 5
  pamatsastāvā un 1 rezervē. Rezervists `srūtrA` ir sasaistīts ar
  neidentificētu 3SM dalībnieku. Šajā kolonnā salīdzinājums neatklāja
  3SM-only vai statusa neatbilstības.

Šī pārbaude **nelaboja Sheets šūnas un nemainīja pieteikumus**. Vietējā lapa
lasīja esošo testa kopiju un piesaistīto Supabase datubāzi.

## Ierobežojumi pirms produkcijas

- Apps Script apstrādā vienas šūnas labojumus. Ja vārds pazūd ar vairāku
  šūnu ielīmēšanu/dzēšanu, periodiskais scans to automātiski neatceļ;
  administrators tagad var pamanīt neatbilstību priekšskatījumā un veikt
  apzinātu atcelšanu.
- Vercel Production nav Google Sheets integrācijas mainīgo. Bez tiem jauni
  tabulas ieraksti publiskajā vietnē automātiski neparādīsies.
- WhatsApp grupas paziņojumiem vēl nepieciešams aktīvs Twilio Conversations
  grupas kanāls un atbilstošie Production iestatījumi.
- Darba kokā ir plašas nekomitētas P0/P1 un Sheets izmaiņas. Pirms
  publicēšanas jāpārskata viss izvietojamais kopums, ne tikai šī posma faili.

## Nākamais posms — publicēšana uz 3sm.lv

1. Pārskatīt un nofiksēt visu P0/P1 izmaiņu kopu; apstiprināt, ka tā ir
   publicējamā versija. Supabase migrācijas 00001–00010 ir jau piemērotas.
2. Sagatavot Vercel Production mainīgos un izvēlēties, vai sākumā
   produkcijā lietot tikai testa Sheets kopiju. Neievietot privātās atslēgas
   repozitorijā vai čatā.
3. Pārbaudīt Apps Script endpoint, WhatsApp režīmu un atcelšanas plūsmu;
   sevišķi jāizlemj, vai grupas paziņojumi jāieslēdz reizē ar publicēšanu.
4. Izvietot uz 3sm.lv un izpildīt `docs/google-sheets-release.md` pēcpalaišanas
   pārbaudes: 8. oktobra dalībnieki, Sheets → 3SM, 3SM → Sheets, aliasa
   pievienošana, rezervists un apzināta atcelšana.

Šajā posmā **nekas nav izvietots Vercel Production**.
