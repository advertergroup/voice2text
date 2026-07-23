import "./globals.css";
import type { ReactNode } from "react";
import { loadContent, t, getLocale } from "../src/lib/content.ts";

export async function generateMetadata() {
  const locale = await getLocale();
  const c = await loadContent(locale);
  return { title: t(c, "seo.title"), description: t(c, "seo.description") };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
