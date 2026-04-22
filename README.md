# 3SM — Amatieru Futbola Komanda

Mājaslapa komandai 3SM, kas spēlē amatieru futbolu kopš 2012. gada.
Domēns: [https://www.3sm.lv](https://www.3sm.lv)

## Struktūra

```
3sm-website/
├── index.html             # Sākumlapa (hero, par komandu, grafiks, galerija)
├── komanda.html           # Visi spēlētāji ar pozīciju filtru
├── spelētājs.html         # Dinamiskais profils (?id=hugo, ?id=muzis, ...)
├── css/style.css          # Brand stils (violets / melns, Bebas Neue + Inter)
├── js/
│   ├── players.js         # 14 aktīvo spēlētāju datu bāze
│   └── main.js            # Navigācija, renderēšana, animācijas
└── images/
    └── logo.svg           # 3SM ģerbonis (ievietots arī kā favicon)
```

## Darbība

Atveram `index.html` jebkurā moderniā pārlūkā — nav nepieciešams build solis.

Deploy: augšupielādē visu mapes saturu uz `3sm.lv` hostingu (statiska vietne).

## Spēlētāju profili

Katram aktīvās komandas spēlētājam ir sava profila lapa:

- [Hugo](spelētājs.html?id=hugo) — #10, Uzbrucējs, Kapteinis
- [Mūzis](spelētājs.html?id=muzis) — #4, Centra aizsargs
- [Mārcis](spelētājs.html?id=marcis) — #8, Centra pussargs
- [Arturs](spelētājs.html?id=arturs) — #7, Labais malējais
- [Artis](spelētājs.html?id=artis) — #2, Labais aizsargs
- [Ints](spelētājs.html?id=ints) — #9, Uzbrucējs
- [Ivo](spelētājs.html?id=ivo) — #6, Defensīvs pussargs
- [Guntis](spelētājs.html?id=guntis) — #5, Centra aizsargs
- [Oliņš](spelētājs.html?id=olins) — #3, Kreisais aizsargs
- [Pēteris](spelētājs.html?id=peteris) — #1, Vārtsargs
- [Niks](spelētājs.html?id=niks) — #11, Kreisais malējais
- [Vents](spelētājs.html?id=vents) — #14, Ofensīvs pussargs
- [Zach](spelētājs.html?id=zach) — #17, Uzbrucējs
- [Piparmētra](spelētājs.html?id=piparmetra) — #21, Universāls

## Nākamie soļi

1. **Aizvietot galerijas placeholderus** ar īstajām bildēm no treniņa
   ([failiem.lv/u/hh95g65vrt](https://failiem.lv/u/hh95g65vrt)) — mape `images/gallery/`.
2. **Pievienot spēlētāju fotogrāfijas** — katram spēlētājam `images/players/{id}.jpg`,
   tad `js/main.js` `renderPlayers()` nomainīt `.player-silhouette` uz `<img>` tagu.
3. **Papildināt** `js/players.js` ar atlikušajiem 43 dalībniekiem, ja vajag
   viņus redzēt komandas lapā.
4. **Sociālo tīklu linki** — footerī `socials` sadaļa.
5. **Kontaktforma** — sākotnēji `mailto:komanda@3sm.lv`, vēlāk var
   pievienot Netlify Forms vai līdzīgu.

## Dizaina pieejas atsauces

Analizētas amatieru sporta mājaslapas: Hackney Marshes Football League,
Sunday League Clubs (UK), LSFL amatieru klubi, kā arī profesionālo
klubu jauniešu akadēmijas. Galvenie novērojumi:

- Kopienas ziņojums > individuālā slava
- Skaidrs treniņu grafiks hero sekcijā
- Spēlētāju profili ar iesaukām, nevis tikai faktiem
- Uzaicinājums pievienoties viegli atrodams
- Foto dominē pār tekstu

Šī lapa to pielāgo 3SM kontekstam — iekļauts komandas stāsts, ceturtdienas
rituāls, Olimpiskais centrs kā otrās mājas un 57 dalībnieku kopiena.
