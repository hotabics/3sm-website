# 3SM — komandas aplikācija

Next.js 15 + Supabase aplikācija amatieru futbola komandai 3SM. Aizvieto iepriekšējo statisko mājas lapu (saglabāta `legacy/`).

## Statuss

- Fāze 1 — Next.js + Tailwind + Supabase + Google OAuth + onboarding ✅
- Fāze 2 — treniņa karte, pieteikšanās/atcelšana, admin panelis, sastāva fiksēšanas cron ✅
- **Fāze 3 (komandas + statistika)** — drag-and-drop sadalītājs, rezultātu ievade un apstiprināšana, statistika ← šobrīd
- Fāze 4 — Stripe maksājumi
- Fāze 5 — WhatsApp paziņojumi (Twilio)
- Fāze 6 — `@3sm.lv` e-pasti (Hostinger)

## Sākt darbu lokāli

```bash
npm install
cp .env.local.example .env.local
# aizpildi Supabase + Google OAuth atslēgas
npm run dev
```

## Supabase setup

1. **Izveido projektu** [supabase.com/dashboard](https://supabase.com/dashboard) (region: West EU).
2. **Project Settings → API** → kopē `URL`, `anon` un `service_role` atslēgas → `.env.local`.
3. **Authentication → Providers → Google** — ieslēdz, ievieto Google OAuth Client ID + Secret.
   - Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client.
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. **SQL Editor** → palaid pēc kārtas:
   - `supabase/migrations/00001_users.sql`
   - `supabase/migrations/00002_trainings.sql`
   - `supabase/migrations/00003_results.sql`
   - `supabase/migrations/00004_payments.sql`
   - `supabase/migrations/00005_optional_payment.sql` (maksa neobligāta, parādi)
   - `supabase/migrations/00006_revoke_trigger_fn_execute.sql`
   - `supabase/migrations/00007_team_notifications.sql`
   - `supabase/migrations/00008_awards.sql`
   - `supabase/migrations/00009_registration_safety_and_notification_outbox.sql`
   - `supabase/migrations/00010_google_sheets_reservations.sql`
   - `supabase/migrations/00011_google_sheets_full_column_import.sql`
   - `supabase/migrations/00012_google_sheet_unidentified_players.sql`
   - `supabase/migrations/00013_register_for_training_optional_payment.sql`
5. Lai izveidotu administratora kontu pēc pirmā logina:
   ```sql
   update public.users set role = 'admin' where email = 'ivo.capins@gmail.com';
   ```

## Cron (Vercel)

`vercel.json` konfigurē sastāva fiksēšanu katru ceturtdienu plkst. 14:00 un 15:00 UTC (sedz 17:00 Rīgas laiku gan vasaras, gan ziemas joslā). Cron endpoint pārbauda `Authorization: Bearer ${CRON_SECRET}` — uzstādi `CRON_SECRET` Vercel project env un `.env.local`.

## WhatsApp grupas paziņojumi

Katrs aktīvs pieteikums bez gaidoša maksājuma (arī neapmaksāts) un katrs
maksājuma apstiprinājums izveido outbox notikumu.
Ziņā ir spēlētāja iesauka/vārds, aktīvo pieteikumu skaits, sastāvs, rinda,
brīvās vietas un laiks līdz pieteikšanās beigām. Notikums tiek sūtīts uzreiz
un kļūmes gadījumā to atkārto `/api/cron/notification-retry`.

Produkcijai vajadzīgs Twilio Conversations WhatsApp grupas SID:

```bash
WHATSAPP_GROUP_MODE=conversations
TWILIO_WHATSAPP_CONVERSATION_SID=CHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Preview vidē atstāj `WHATSAPP_GROUP_MODE=disabled`. `fanout` ir tikai apzināta
pārejas alternatīva, kas izsūta individuālu ziņu katram lietotājam un nav īsts
grupas čats. Pirms produkcijas jāapstiprina WhatsApp utility template un
jāpārbauda piegāde ar atsevišķu testa grupu.

## Google Sheets rezervāciju tests

Rezervāciju patiesības avots ir Supabase. Google Sheets ir otrs, uzticams
ievades veids. Sinhronizācijas cron vispirms nolasa visu katram datumam
piesaistīto kolonnu: 8.–21. rinda ir pamatsastāvs, 22. rinda tiek izlaista,
no 23. rindas uz leju ir rezerve. 7. rindas skaitlis rāda tikai pamatsastāvu.
Vārds bez sasaistīta 3SM konta tiek importēts kā **neidentificēts dalībnieks**:
tam ir redzams profils un pieteikums, bet nav Auth konta, e-pasta vai piekļuves
privātām darbībām. Identificēti spēlētāji tiek importēti arī bez apmaksas —
sastāva fiksēšanā viņiem rodas parāds. Dublēta vārda vai nesasaistīta
spēlētāja gadījumā atbilde ietver `scanErrors`, un šī kolonna netiek pārrakstīta.
Pēc veiksmīgas nolasīšanas un importa Sheets tiek atjaunots no Supabase.
Eksportā tiek saglabāts kolonnā jau izmantotais
vārda variants vai izvēlēts apstiprināts alias; bez aliasa vietnes pieteikums
netiek eksportēts, lai nākamajā lasījumā nekļūtu par nezināmu spēlētāju.
Ja rezervisti turpinās pēc 40. rindas, rakstīšanas
diapazons tiek paplašināts tikai līdz pēdējam atrastajam ierakstam (drošības
robeža — 10 000. rinda).

Atsevišķas šūnas labojums var nonākt API arī kā Apps Script parakstīta komanda.
Dzēšana/atcelšana pašlaik tiek apstrādāta ar šo Apps Script plūsmu; periodiskais
pilnas kolonnas scans importē jaunus pieteikumus un automātiski neatceļ tos,
kas no tabulas pazuduši. Tas nepieļauj vietnes pieteikuma atcelšanas nejaušu
atjaunošanu no vēl neatjaunotas Sheets kolonnas.

Testa kopijai izmanto `GOOGLE_SHEETS_TEST_SPREADSHEET_ID`. Pirms ieslēgt
`GOOGLE_SHEETS_SYNC_ENABLED=true`:

1. Google Cloud projektā ieslēdz Google Sheets API un izveido service account.
2. Testa tabulu kopīgo ar service account e-pastu kā **Editor**.
3. Vercel un `.env.local` ievieto `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY` un nejauši ģenerētu
   `GOOGLE_SHEETS_WEBHOOK_SECRET`. Privātās atslēgas rindas jāglabā kā `\n`.
4. Testa tabulā atver **Paplašinājumi → Apps Script**, ielīmē
   `google-sheets/apps-script/Code.gs`, Script Properties iestati
   `3SM_ENDPOINT=https://<preview-domēns>/api/integrations/google-sheets/intent`
   un `3SM_WEBHOOK_SECRET`, pēc tam vienreiz palaid `install3smOnEditTrigger`.
5. Admina panelī atver `/admin/integrations/google-sheets`, piesaisti īstu
   testa treniņu Sheets datumam un pievieno katra testētāja vārda/iesaukas
   variantus (atdalot ar komatu vai jaunu rindu) vienam 3SM profilam.
   Piemēram, `Jānis Mūzis`, `Mūzis` un `Muzis` ir trīs atsevišķi, skaidri
   apstiprināti varianti; sistēma neuzmin spēlētāju pēc līdzīga vārda. Ja
   neidentificētais dalībnieks jau ir importēts, aliasa pievienošana pārvieto
   viņa pieteikumus uz izvēlēto 3SM profilu un noņem viesu dublikātu.
6. Pie katra aktīvā kartējuma nospied **Pārbaudīt visu kolonnu**. Pārbaude
   tikai nolasa tabulu un 3SM datus; tā parāda arī 23. rindas rezervistus,
   vārdus bez 3SM konta, 3SM pieteikumus bez Sheets ieraksta un atšķirīgu
   pamatsastāva/rezerves statusu, neko neimportējot un nepārrakstot. Pirms pirmās
   rakstošās sinhronizācijas izlabo dublētos vārdus un apzināti pārbaudi,
   kuri tiks importēti kā neidentificēti dalībnieki.

Pēc `00011` un `00012` migrāciju piemērošanas un ar darbojošos `npm run dev` palaid
`npm run sheets:sync`, lai lokāli vienreiz noskenētu visas piesaistītās datuma
kolonnas. Komanda neizdrukā slepenās atslēgas un parāda `imported`, `sent`,
`held` un `scanErrors`. Ja `scanErrors` nav tukšs, izlabo norādītos Sheets
vārdus vai to sasaisti un palaid komandu vēlreiz; kļūdainā kolonna netiek
pārrakstīta. Neizsauc šo komandu ar īsto tabulu, kamēr tests nav pārbaudīts.

Skripts neizveido pieteikumu, ja datums nav kartēts vai reģistrācija ir
slēgta. Apmaksa nav priekšnoteikums. Vārds bez
sasaistes tiek saglabāts kā neidentificēts, nevis piesaistīts uzminētam
profilam. `google-sheets-sync` cron drīkst
darboties arī tad, kad sinhronizācija ir izslēgta — gaidošie notikumi paliek
rindā, un nekas netiek sūtīts uz Google.

## Struktūra

```
src/
  app/
    page.tsx                       # / — nākamā treniņa karte
    login/                         # /login (Google OAuth + Suspense)
    onboarding/                    # /onboarding (vārds, telefons, WhatsApp)
    auth/callback/route.ts         # OAuth redirect
    admin/trainings/               # admin: izveidot, sastāvs, atcelt
    actions/
      registrations.ts             # piesakās / atceļ
      admin.ts                     # izveidot treniņu, apstiprināt, atcelt
    api/cron/close-registration/   # ceturtdiena 17:00 → fiksē sastāvu
  components/
    site-header.tsx
    training-card.tsx
    register-button.tsx
    sign-out-button.tsx
  lib/
    auth.ts                        # getCurrentProfile, requireAdmin
    time.ts                        # Europe/Riga TZ helpers
    trainings.ts                   # treniņu queries
    supabase/{client,server,middleware,admin}.ts
  middleware.ts
supabase/migrations/               # 00001_users, 00002_trainings
legacy/                            # iepriekšējā statiskā mājas lapa
vercel.json                        # cron schedule
```
