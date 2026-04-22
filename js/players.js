/**
 * 3SM — Spēlētāju datu bāze
 * Visi aktīvie spēlētāji ar profiliem
 */

const PLAYERS = [
  {
    id: "hugo",
    name: "Hugo",
    nickname: "Kapteinis",
    number: 10,
    position: "Uzbrucējs",
    positionShort: "UZB",
    joinedYear: 2012,
    tagline: "Leģenda, kas zina katru stūri laukumā.",
    bio: "Hugo ir viens no komandas dibinātājiem un tās nepārspētais kapteinis kopš 2012. gada. Viņa precīzās piespēles un neiztrūkstošā klātbūtne ceturtdienu treniņos ir padarījusi viņu par 3SM sirdi. Ikviens zina — ja Hugo ir laukumā, spēle notiks pareizi.",
    traits: {
      "Kāju darbs": "Abas kājas",
      "Treniņu apmeklējums": "98%",
      "Parakstsgājiens": "Dziļš tālšāviens",
      "Iemīļotais brīdis": "Uzvara pret JT komandu 2019"
    },
    stats: {
      "Sezonas": 14,
      "Vārti": 142,
      "Piespēles": 186,
      "Treniņi": 612
    }
  },
  {
    id: "muzis",
    name: "Mūzis",
    nickname: "Mūris",
    number: 4,
    position: "Centra aizsargs",
    positionShort: "AIZ",
    joinedYear: 2013,
    tagline: "Neviens netiek cauri — pat ne bumba.",
    bio: "Mūzis ir mūsu aizsardzības stūrakmens. Fiziski spēcīgs, taktiski domājošs un vienmēr gatavs iemet savu ķermeni pa priekšu pretinieka tālšāvienam. Ja jautāsi komandai, kurš nozog visvairāk bumbu, atbilde vienmēr būs Mūzis.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "95%",
      "Parakstsgājiens": "Slaidgājiens",
      "Iemīļotais brīdis": "Tīrs šķērsojums gruntīgā dubļu treniņā"
    },
    stats: {
      "Sezonas": 13,
      "Vārti": 18,
      "Piespēles": 94,
      "Treniņi": 548
    }
  },
  {
    id: "marcis",
    name: "Mārcis",
    nickname: "Motors",
    number: 8,
    position: "Centra pussargs",
    positionShort: "PUS",
    joinedYear: 2013,
    tagline: "Nepārtraukts motors, kas nekad neapstājas.",
    bio: "Mārcis skrien visu spēli — no pirmās minūtes līdz pēdējai piespēlei garderobē. Viņa izturība ir kļuvusi par leģendu ceturtdienu treniņos. Vienmēr aktīvs, vienmēr gatavs pievienoties uzbrukumam un atgriezties aizsardzībā.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "92%",
      "Parakstsgājiens": "Bezgalīgā skriešana",
      "Iemīļotais brīdis": "Pilns treniņš bez aizelsšanās"
    },
    stats: {
      "Sezonas": 13,
      "Vārti": 87,
      "Piespēles": 124,
      "Treniņi": 531
    }
  },
  {
    id: "arturs",
    name: "Arturs",
    nickname: "Tehniķis",
    number: 7,
    position: "Labais malējais",
    positionShort: "MAL",
    joinedYear: 2014,
    tagline: "Elegance uz labās malas.",
    bio: "Arturs ir mūsu tehniķis — katrs pieskāriens bumbai ir pārdomāts, katra piespēle precīzi adresēta. Ja redzat gracilu aizvilšanu pa malu un perfektu centrējumu, visticamāk, tas ir Arturs. Vienmēr pozitīvs un komandas dvēseles uzmundrinātājs.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "88%",
      "Parakstsgājiens": "Centrējums ar āru",
      "Iemīļotais brīdis": "Perfektā centrējums Hugo"
    },
    stats: {
      "Sezonas": 12,
      "Vārti": 52,
      "Piespēles": 163,
      "Treniņi": 478
    }
  },
  {
    id: "artis",
    name: "Artis",
    nickname: "Siena",
    number: 2,
    position: "Labais aizsargs",
    positionShort: "AIZ",
    joinedYear: 2014,
    tagline: "Droši kā klints, ātri kā vilciens.",
    bio: "Artis spēj gan nobloķēt bumbu savā trešdaļā, gan aiziet cauri pussardznām un palīdzēt uzbrukumā. Viņa divpusība un taktiskā izpratne padara viņu par vienu no neaizstājamākajiem spēlētājiem.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "90%",
      "Parakstsgājiens": "Nolaušana zem spiediena",
      "Iemīļotais brīdis": "Dubultais aizsardzības glābiens"
    },
    stats: {
      "Sezonas": 12,
      "Vārti": 24,
      "Piespēles": 89,
      "Treniņi": 498
    }
  },
  {
    id: "ints",
    name: "Ints",
    nickname: "Lapsa",
    number: 9,
    position: "Uzbrucējs",
    positionShort: "UZB",
    joinedYear: 2015,
    tagline: "Klusā lapsa, kas jums noiet cauri.",
    bio: "Ints nekad nav troksnis ap sevi, bet rezultāts vienmēr tāds, ka viņš jums iesit. Viņam piemīt tā retā spēja — atrasties īstajā vietā īstajā brīdī. Trešdien treniņā viņš jau zina, kur sestdien būs bumba.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "93%",
      "Parakstsgājiens": "Klusais priekšpuses šāviens",
      "Iemīļotais brīdis": "Četri vārti vienā treniņā"
    },
    stats: {
      "Sezonas": 11,
      "Vārti": 128,
      "Piespēles": 71,
      "Treniņi": 452
    }
  },
  {
    id: "ivo",
    name: "Ivo",
    nickname: "Režisors",
    number: 6,
    position: "Defensīvs pussargs",
    positionShort: "PUS",
    joinedYear: 2012,
    tagline: "Spēles dirigents vidū.",
    bio: "Ivo ir komandas metronoms — kontrolē tempu, sadala bumbu un vienmēr zina nākamo gājienu. Ja komandai vajadzīga atmiņa par to, kad un kā kāds gāja, Ivo atbildēs bez piezīmēm. Viens no dibinātājiem.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "96%",
      "Parakstsgājiens": "Garā diagonālā piespēle",
      "Iemīļotais brīdis": "3SM pirmā lielā uzvara"
    },
    stats: {
      "Sezonas": 14,
      "Vārti": 46,
      "Piespēles": 218,
      "Treniņi": 595
    }
  },
  {
    id: "guntis",
    name: "Guntis",
    nickname: "Tvītuvis",
    number: 5,
    position: "Centra aizsargs",
    positionShort: "AIZ",
    joinedYear: 2013,
    tagline: "Klusais līderis aizsardzībā.",
    bio: "Guntis runā maz, bet spēlē tā, ka nevajag vārdus. Viņa lasītspēja ir izcila — redz uzbrukumu pirms pretinieks to iedomājas. Pārī ar Mūzi veido vienu no drošākajām amatieru futbola sirds aizsardzībām.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "89%",
      "Parakstsgājiens": "Lasītā presings",
      "Iemīļotais brīdis": "Nulles aizsardzība visa treniņa laikā"
    },
    stats: {
      "Sezonas": 13,
      "Vārti": 14,
      "Piespēles": 76,
      "Treniņi": 521
    }
  },
  {
    id: "olins",
    name: "Oliņš",
    nickname: "Cīnītājs",
    number: 3,
    position: "Kreisais aizsargs",
    positionShort: "AIZ",
    joinedYear: 2013,
    tagline: "Neviena bumba netiek zaudēta bez cīņas.",
    bio: "Oliņš ir cīnītājs pilnā šī vārda nozīmē. Katrs duelis ir svarīgs, katra piespēle ir godu lietas. Kreisā maliņa viņa pārziņā ir droša vieta — pretinieki mācās viņu izvairīties.",
    traits: {
      "Kāju darbs": "Kreisā",
      "Treniņu apmeklējums": "91%",
      "Parakstsgājiens": "Duelē nebeidzama neatlaidība",
      "Iemīļotais brīdis": "Vēlā spēles uzvaras piespēle"
    },
    stats: {
      "Sezonas": 13,
      "Vārti": 22,
      "Piespēles": 108,
      "Treniņi": 510
    }
  },
  {
    id: "peteris",
    name: "Pēteris",
    nickname: "Ķaugurs",
    number: 1,
    position: "Vārtsargs",
    positionShort: "VAR",
    joinedYear: 2014,
    tagline: "Pēdējā līnija pirms ziņām.",
    bio: "Pēteris ir mūsu vārtsargs — mierīgs, uzmanīgs un ar reakciju, kas liek domāt par profesionāļiem. Ļoti daudzas uzvaras komanda parāda tieši viņam. Treniņā vienmēr pirmais un pēdējais, kurš iet mājās.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "97%",
      "Parakstsgājiens": "Refleksa izglābšana",
      "Iemīļotais brīdis": "Pilnībā noturēti vārti pret spēcīgu pretinieku"
    },
    stats: {
      "Sezonas": 12,
      "Vārti": 2,
      "Izglābšanas": 847,
      "Treniņi": 489
    }
  },
  {
    id: "niks",
    name: "Niks",
    nickname: "Raķete",
    number: 11,
    position: "Kreisais malējais",
    positionShort: "MAL",
    joinedYear: 2016,
    tagline: "Ātrākais komandā — un viņš to zina.",
    bio: "Niks sprintē pa kreiso malu ātrumā, par kuru citiem jāsapņo. Jaunākais no aktīvās grupas, bet jau sen pierādījis savu vietu. Ja redzat zibeni kreisajā laukuma malā, tas ir Niks.",
    traits: {
      "Kāju darbs": "Kreisā",
      "Treniņu apmeklējums": "86%",
      "Parakstsgājiens": "Sprints pa malu",
      "Iemīļotais brīdis": "100m pa malu bez apstāšanās"
    },
    stats: {
      "Sezonas": 10,
      "Vārti": 68,
      "Piespēles": 94,
      "Treniņi": 412
    }
  },
  {
    id: "vents",
    name: "Vents",
    nickname: "Brīze",
    number: 14,
    position: "Ofensīvs pussargs",
    positionShort: "PUS",
    joinedYear: 2017,
    tagline: "Radoša prātība vidū.",
    bio: "Vents ir komandas kreatīvais gars. Negaidītas piespēles, netipiski risinājumi un tā maza smaida klātbūtne pēc katra labā trika. Ja spēle kļūst garlaicīga, viņš pārvērš to interesantā.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "84%",
      "Parakstsgājiens": "No-look piespēle",
      "Iemīļotais brīdis": "Trīsstūra piespēle ar Hugo un Arturu"
    },
    stats: {
      "Sezonas": 9,
      "Vārti": 54,
      "Piespēles": 137,
      "Treniņi": 371
    }
  },
  {
    id: "zach",
    name: "Zach",
    nickname: "Ārlietas",
    number: 17,
    position: "Uzbrucējs",
    positionShort: "UZB",
    joinedYear: 2018,
    tagline: "Komandas starptautiskais flāvors.",
    bio: "Zach atnesis komandā citu stila pieskārienu — tehnika, kas smaržo pēc citas ligas, un vienmēr prieks atrasties laukumā. Viņa smaids pēc vārtiem ir aizlipinošs, viņa darbs uzbrukumā — nepārprotams.",
    traits: {
      "Kāju darbs": "Labā",
      "Treniņu apmeklējums": "82%",
      "Parakstsgājiens": "Pirmā pieskāriena vārti",
      "Iemīļotais brīdis": "Debijas vārti 3SM"
    },
    stats: {
      "Sezonas": 8,
      "Vārti": 73,
      "Piespēles": 61,
      "Treniņi": 312
    }
  },
  {
    id: "piparmetra",
    name: "Piparmētra",
    nickname: "Svaigums",
    number: 21,
    position: "Universāls",
    positionShort: "UNI",
    joinedYear: 2019,
    tagline: "Tur, kur citi pagurst, sāk viņa.",
    bio: "Piparmētra — iesauka, kas ir izteikusi sevi. Vienmēr svaiga enerģija, vienmēr gatava spēlēt jebkurā pozīcijā. No vārtiem līdz uzbrukumam, no treniņa līdz treniņam. Komandas iecienītākais universālais spēlētājs.",
    traits: {
      "Kāju darbs": "Abas kājas",
      "Treniņu apmeklējums": "87%",
      "Parakstsgājiens": "Pozīcijas maiņa spēles vidū",
      "Iemīļotais brīdis": "Spēle visās 5 pozīcijās vienā treniņā"
    },
    stats: {
      "Sezonas": 7,
      "Vārti": 41,
      "Piespēles": 88,
      "Treniņi": 276
    }
  }
];

// Pozīciju filtri
const POSITIONS = [
  { id: "all", label: "Visi" },
  { id: "VAR", label: "Vārtsargi" },
  { id: "AIZ", label: "Aizsargi" },
  { id: "PUS", label: "Pussargi" },
  { id: "MAL", label: "Malējie" },
  { id: "UZB", label: "Uzbrucēji" },
  { id: "UNI", label: "Universālie" }
];

// Ja pieejama kā modulis
if (typeof window !== "undefined") {
  window.PLAYERS = PLAYERS;
  window.POSITIONS = POSITIONS;
}
