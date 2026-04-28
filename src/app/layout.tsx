import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3SM — Futbols kā dzīvesveids",
  description:
    "Amatieru futbola komanda 3SM. Spēlējam katru ceturtdienu plkst. 20:00.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lv">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
