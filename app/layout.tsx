import "./globals.css";
import type { ReactNode } from "react";
import Script from "next/script";
import { loadContent, t, getLocale } from "../src/lib/content.ts";
import { Comportamiento } from "../src/ui/Comportamiento.tsx";

// Google tag de Google Ads (medición de conversiones; la conversión se define por URL /thanks en el panel de Ads).
const GADS_ID = "AW-18399245321";

export async function generateMetadata() {
  const locale = await getLocale();
  const c = await loadContent(locale);
  return { title: t(c, "seo.title"), description: t(c, "seo.description") };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        {children}
        <Comportamiento />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GADS_ID}`} strategy="afterInteractive" />
        <Script id="gads-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GADS_ID}');
        `}</Script>
      </body>
    </html>
  );
}
