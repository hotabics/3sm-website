// PROTOTIPS — izmetams. Jautājums: kā panākt, lai pieteikšanās uz treniņu
// būtu „1-2 un gatavs"? Trīs strukturāli atšķirīgi varianti uz viena
// maršruta, pārslēdzami ar ?variant=A|B|C. Dati un mutācijas ir viltoti
// (atmiņā), Supabase netiek aiztikts.
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PrototypeVariants } from "./prototype-variants";

export const metadata = { title: "PROTOTIPS · Pieteikšanās" };

export default function PrototypePage() {
  // Rādām lokāli un Vercel preview vidē, bet nekad produkcijā.
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <Suspense>
      <PrototypeVariants />
    </Suspense>
  );
}
