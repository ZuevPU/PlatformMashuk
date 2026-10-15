import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { geologica, notoSerif } from "@/lib/fonts";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL || "https://109.71.247.90.sslip.io"),
  title: {
    default: "Программы Центра знаний «Машук»",
    template: "%s — Центр знаний «Машук»",
  },
  description:
    "Цифровая экосистема сопровождения слушателей АНО «Центр знаний «Машук»: программы, материалы, общение участников и живая обратная связь.",
  applicationName: "Центр знаний «Машук»",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Машук", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "Центр знаний «Машук»",
    title: "Программы Центра знаний «Машук»",
    description: "Программы, материалы, общение участников и живая обратная связь — в одной среде.",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.navy,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      // Расширения браузера (например, LanguageTool) дописывают свои атрибуты
      // в <html> уже после отрисовки — для этого элемента предупреждение гасим.
      suppressHydrationWarning
      className={`${geologica.variable} ${notoSerif.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main id="top" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
