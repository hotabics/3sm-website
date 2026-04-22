# 3SM — Dizaina rekomendācijas

Dokuments strukturēts tā, lai **katru rekomendāciju var realizēt ar konkrētu Claude skill**.
Izsauc to ar `/skill-name` vai lūdz Claude izmantot norādīto skill.

---

## 1. Vizuālā identitāte un brand sistēma

### 1.1. Brand motion identitāte
**Skill:** `brand-strategist`, `brand-consistency`

3SM ģerbonī ir divi elementi (silueti + 2012 gads), kas varētu kļūt par kustības identitātes pamatu:
- Silueti — "divi kopā" — parādās komandas lapā kā multi-player avatāri
- Gads 2012 — kā atpakaļskaitīšanas elements ("14 gadi, 7 mēneši...")
- Bumba virs ģerboņa — lec/ripo katrā interakcijā (hover, load)

**Rezultāts:** Brand guidelines dokuments ar kustības tokeniem (easing, duration, character).

### 1.2. Krāsu sistēmas paplašināšana
**Skill:** `design:design-system`, `frontend-designer`

Pašreizējā paletē ir 3 violetie toņi. Trūkst:
- **Semantiskās krāsas** — success (vārti iesisti), warning (treniņa atcelšana), info (jaunās ziņas)
- **Pozīciju krāsu kods** — vārtsargs, aizsargs, pussargs, uzbrucējs (vēlāk ikonogrāfijai)
- **Tumša/gaiša režīma tokenu pāri** — pašlaik tikai tumšais

**Deliverable:** `design-tokens.json` + CSS custom properties abiem režīmiem.

### 1.3. Industrial brutal vs. minimalist virziens
**Skill:** `industrial-brutalist-ui`, `minimalist-ui`

Var izvēlēties vienu no diviem stiliem:
- **Brutal / Sports-kodekss** — sporta veidu klubu estētika, eksponēti tīkla līniju, pārmērīga tipogrāfija, lauka marķējuma grafika
- **Minimālistisks / Editorial** — kā The Players' Tribune, liels balts laukums, fokuss uz stāstu

**Ieteikums:** Hibrīds — brutal hero sekcijām (enerģija), minimal profiliem (stāsts).

---

## 2. Komponentu bibliotēka

### 2.1. shadcn/ui integrācija (ja pāreja uz React/Next.js)
**Skill:** `shadcn-ui`

Ja plāno migrēt no static HTML uz Next.js (kā tavs eSkola projekts), šie komponenti ir tieši piemēroti:
- `Card` — spēlētāju grid
- `Tabs` — pozīciju filtrs komandas lapā
- `Dialog` — galerijas lightbox
- `Badge` — spēlētāju numuri, pozīcijas
- `Avatar` — spēlētāju miniatūras
- `Separator`, `ScrollArea` — grafiks, statistika

### 2.2. Spēlētāja kartes varianti (A/B)
**Skill:** `cards-containers`, `micro-interactions`

Pašlaik ir viena kartes dizaina variants. Piedāvāju 3:
- **A (pašreizējais):** Silhouette + dižais numurs stūrī
- **B (foto):** Reāla foto + hover reveal ar stats
- **C (minimāls):** Tikai tipogrāfija, numurs + vārds + pozīcija kā etiķete

**Skill:** var vienkārši lūgt Claude `/cards-containers` `/micro-interactions` izveidot variantus.

### 2.3. Statistikas vizualizācijas
**Skill:** `data-visualization`, `data:data-visualization`

Spēlētāja profilā ir 4 skaitliski rādītāji — šobrīd parādīti kā cipari. Uzlabojumi:
- **Radar chart** — iemaņas (ātrums, tehnika, izturība, spēks, komandas darbs)
- **Sezonu timeline** — kad pievienojās, aktivitātes peakes
- **Attendance heatmap** — treniņu apmeklējums pa mēnešiem (GitHub-style)

---

## 3. Animācijas & Kustība

### 3.1. Hero sekcijas iedzīvināšana
**Skill:** `entrance-animations`, `gsap-greensock`, `framer-motion`

Pašreiz ģerbonis "peld" (float). Var pievienot:
- **Staggered entrance** — badge → virsraksts → paragraph → pogas → statistikas parādās secīgi (80ms delay)
- **Parallax uz scroll** — ģerbonis un fona grids kustas dažādos ātrumos
- **Magnetic hover** uz CTA pogām — bumba "pievelk" kursoru

### 3.2. Spēlētāju grid mikroanimācijas
**Skill:** `lists-grids`, `hover-interactions`, `exaggerated-clarity`

Filtra izmaiņas gadījumā:
- **FLIP animation** — kartes slīd nevis „pazūd/parādās"
- **Hover:** numurs pieaug, silhouette paceļas, parādās "Skatīt profilu" cilpa

### 3.3. Lapas pāreju orķestrēšana
**Skill:** `page-transitions`, `orchestrated-sequences`

Pāreja no `komanda.html` uz `spelētājs.html`:
- Kartes dižais numurs → pārvietojas un pieaug jaunajā lapā (View Transitions API)
- Krāsu gradienta zibsnis starp lapām

### 3.4. Scroll-triggered stāsta sekcija
**Skill:** `scroll-animations`, `filmmaker`

Jauna sekcija "Mūsu 14 gadu ceļojums":
- Timeline, kas atklājas rituminot
- 2012 → 2026 ar nozīmīgiem brīžiem (pirmais treniņš, 100-ais dalībnieks, utt.)
- Video/GIF inserti no treniņiem

---

## 4. Spēlētāju profili — padziļinājums

### 4.1. Storytelling layout
**Skill:** `emotional-narrative`, `filmmaker`, `universal-emotion`

Katrs profils varētu būt kā mini-dokumentālā filma:
- **Intro** — lielais numurs, iesauka, "parakstu citāts"
- **Iemīļotais brīdis** — citāts rāmītī, vēlams ar audio snippet no spēles
- **Komandas atsauksmes** — "Ko par viņu saka citi" (Hugo par Mūzi, Mūzis par Hugo)
- **Outro** — "Atrodi Mūzi arī šeit" — CTA uz sociāliem tīkliem

### 4.2. Interactive player comparison
**Skill:** `data:data-visualization`, `product-management:competitive-brief`

„Salīdzināt spēlētājus" funkcija:
- Izvēlies 2-3 spēlētājus → vai grafikā rādīt prasmes, stats
- Noderīgi pirms treniņa komandu dalījumam

### 4.3. Pozīciju kartē
**Skill:** `spatial-thinking`, `attention-direction`

Vizualizēt lauka diagrammā, kur spēlētājs parasti atrodas:
- Pozīciju heatmap
- Klikšķināms laukums ar spēlētāja iekrāsotu zonu

---

## 5. Navigācija un informācijas arhitektūra

### 5.1. UX pārskats un navigācijas kritika
**Skill:** `design:design-critique`, `design:user-research`

Pašlaik navigācija ir linearā. Jāpārbauda:
- Vai spēlētāja profilā ir viegli pāriet uz nākamo spēlētāju? (NAV)
- Vai no galerijas var viegli atgriezties tajā pašā vietā? (NAV)
- Vai mobilais burger menu pārklāj saturu? (jā, jāuzlabo)

### 5.2. Sticky pielāgota navigācija profila lapā
**Skill:** `navigation-menus`, `responsive-adaptive`

Spēlētāja profila lapā:
- Sticky „nākamais / iepriekšējais spēlētājs" josla apakšā
- Ātrs „atpakaļ uz komandu" ar breadcrumb

---

## 6. UX Copy un tonis

### 6.1. Mikro-teksti un tukšie stāvokļi
**Skill:** `design:ux-copy`

Trūkst šādos vietās:
- **404 lapa** — „Šī lapa ir kā Hugo stūra sitiens pa malu — aizlidoja kaut kur citur"
- **Filtrs bez rezultātiem** — „Tajā pozīcijā vēl nav neviena — vai gribi kļūt par pirmo?"
- **Form validation** — „E-pasts ir kā piespēle — vajag, lai sasniedz adresātu"

### 6.2. Komandas „balss" dokuments
**Skill:** `brand-voice:generate-guidelines`, `brand-voice:enforce-voice`

Pašlaik tekstu tonis ir silts un humora pilns. Jāfiksē vadlīnijās:
- **Tonis:** Siltais, nedaudz sevis-ironiskais, amatieru lepnums
- **Neuzrunājam:** ar „Jūs" (ar "Tu")
- **Terminoloģija:** „laukums" nevis „stadions", „ceturtdiena" ar lielu nozīmi

---

## 7. Accessibility un iekļaujošā pieredze

### 7.1. WCAG 2.1 AA audits
**Skill:** `design:accessibility-review`, `accessibility-advocate`

Jāpārbauda:
- Krāsu kontrasts — `--text-muted` uz `--bg-dark` var nesasniegt 4.5:1
- Focus indicators — tabulācijas navigācija nav vizuāli skaidra
- `prefers-reduced-motion` — fade-up animācijas jāizslēdz
- ARIA labels navigācijai un kartēm

### 7.2. Motion sensitivity
**Skill:** `accessible-motion`, `motion-sickness`

Ģerboņa `float` animācija 6s intervālā var izraisīt diskomfortu:
- Pievienot `@media (prefers-reduced-motion: reduce)` ar statisku variantu
- Piedāvāt „samazināt kustību" pogu iestatījumos

---

## 8. Galerijas risinājums

### 8.1. Foto galerijas paraugs
**Skill:** `web-design-research`, `anthropic-skills:web-design-research`

Analizēt:
- Apple fotoalbumi
- Unsplash kolekcijas
- New York Times fotoreportāžas

Rezultāts: masonry grid ar lightbox, kas atbalsta:
- Klaviatūras navigāciju (← →)
- Swipe uz mobilā
- Caption no katra attēla
- „Kurš ir bildē" (tagging) — var klikšķināt uz spēlētāja galvas un pāriet uz profilu

### 8.2. Optimizēta attēlu piegāde
**Skill:** `asset-optimization`, `performance-optimization`

- WebP/AVIF formāts ar JPEG fallback
- `srcset` un `sizes` attēliem
- Lazy loading `loading="lazy"`
- Blur-up placeholder (LQIP) pirms ielādes

---

## 9. Mobilā pieredze

### 9.1. Touch-optimizācija
**Skill:** `mobile-touch`, `apple-hig-designer`

- Minimālais touch target 44px (šobrīd dažas pogas ir 36px)
- Swipe gestures galerijā un spēlētāju navigācijā
- Pull-to-refresh jaunumu sekcijā (kad tāda būs)
- Haptic feedback (iOS PWA gadījumā) pie svarīgām interakcijām

### 9.2. PWA funkcionalitāte
**Skill:** `frontend-developer`, `fullstack-dev`

- Manifest + service worker
- Offline režīms (spēlētāju saraksts cache)
- Add to homescreen ikona
- Push notifikācijas par nākamo treniņu

---

## 10. Jaunas sekcijas un funkcijas

### 10.1. Treniņu kalendārs
**Skill:** `lists-grids`, `data-visualization`

- Mēneša kalendāra skats ar ceturtdienām
- Klikšķis uz datuma → kurš bija/nebija, rezultāti, foto
- RSVP funkcionalitāte („Es būšu!")

### 10.2. „Ziņas no laukuma" blogs
**Skill:** `marketing:draft-content`, `content-brief-generator`

Īsi ieraksti pēc katra treniņa:
- 3-5 teikumi par spēli
- TOP moments
- „Vakara spēlētājs" izvēle

### 10.3. Statistikas dashboard
**Skill:** `data:build-dashboard`

Publiskais dashboards ar:
- Kurš apmeklē visvairāk
- Kurš iesit visvairāk vārtu
- Apmeklētības trends
- Leaderboards (fun kategorijas: „garākais sprints", „ilgākā piespēle" ja ir tracking)

### 10.4. Sponsors un atbalstītāji
**Skill:** `frontend-design`, `brand-consistency`

Ja/kad parādās sponsori — īpaša sekcija ar:
- Logo karuseli
- Individuālie sponsoru blokiem
- „Kā atbalstīt" CTA

---

## 11. Performance un tehniskais audits

### 11.1. Core Web Vitals
**Skill:** `performance-optimization`, `implementation-debugging`

- LCP < 2.5s (šobrīd iespējams 3s+ dēļ Google Fonts)
- CLS < 0.1 (jāpārbauda, vai spēlētāju kartes nerada layout shift)
- INP < 200ms (jāpārbauda filtru klikšķi)

### 11.2. Font loading stratēģija
**Skill:** `asset-optimization`

- `font-display: swap` jau ir Google Fonts
- Subset tikai lietotiem latīņu burtiem (samazina 40%)
- Preload tikai galvenajiem font weight

---

## 12. SEO un atklāšana

### 12.1. Structured data
**Skill:** `ai-seo`

Pievienot JSON-LD:
- `SportsTeam` schema mājaslapas līmenī
- `Person` schema katram spēlētājam
- `Event` schema treniņiem
- `Place` schema Olimpiskais centrs

### 12.2. AI search optimizācija
**Skill:** `ai-seo`

Gatavoties, ka ChatGPT/Claude/Perplexity lietotāji meklēs „amatieru futbola komanda Rīgā":
- FAQ sekcija ar dabiski formulētiem jautājumiem
- Clear, citeable statements
- Skaidra hierarhija H1-H3

---

## Kā sākt — ieteiktā secība

| Prioritāte | Uzdevums | Skill |
|------------|----------|-------|
| 1 | Galerijas attēli + optimizācija | `/asset-optimization` |
| 2 | Accessibility audits | `/design:accessibility-review` |
| 3 | Spēlētāju foto + profilu padziļinājums | `/emotional-narrative` |
| 4 | Treniņu kalendārs | `/data:build-dashboard` |
| 5 | PWA + offline | `/frontend-developer` |
| 6 | Structured data SEO | `/ai-seo` |
| 7 | Stāsta sekcija ar scroll animācijām | `/scroll-animations` |
| 8 | Dark/Light mode switch | `/design:design-system` |

---

## Kā izsaukt skill Claude Code vidē

```
/design:design-critique    # UX pārskats un feedback
/design:accessibility-review    # WCAG audits
/frontend-designer         # Komponentu bibliotēka
/gsap-greensock           # Animāciju implementācija
/scroll-animations        # Scroll-triggered efekti
/cards-containers         # Karšu varianti
/ai-seo                   # AI search optimizācija
```

Vienkārši rakstot `/skill-name` čatā, Claude ielādē attiecīgo domēna zināšanu bāzi un
pielāgo savu darbu konkrētajam kontekstam.
