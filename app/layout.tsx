import "./globals.css";
import type { ReactNode } from "react";
import Script from "next/script";
import { loadContent, t, getLocale } from "../src/lib/content.ts";
import { Comportamiento } from "../src/ui/Comportamiento.tsx";

// Google tag de Google Ads (medición de conversiones; la conversión se define por URL /thanks en el panel de Ads).
const GADS_ID = "AW-18399245321";
// Microsoft Clarity (grabaciones de sesión + mapas de calor en clarity.microsoft.com).
const CLARITY_ID = "yb9ai60tdt";

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
        <Script id="ms-clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_ID}");
        `}</Script>
      </body>
    </html>
  );
}
