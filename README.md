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
5. Lai izveidotu administratora kontu pēc pirmā logina:
   ```sql
   update public.users set role = 'admin' where email = 'ivo.capins@gmail.com';
   ```

## Cron (Vercel)

`vercel.json` konfigurē sastāva fiksēšanu katru ceturtdienu plkst. 14:00 un 15:00 UTC (sedz 17:00 Rīgas laiku gan vasaras, gan ziemas joslā). Cron endpoint pārbauda `Authorization: Bearer ${CRON_SECRET}` — uzstādi `CRON_SECRET` Vercel project env un `.env.local`.

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
