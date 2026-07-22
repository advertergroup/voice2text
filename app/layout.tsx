import "./globals.css";
import type { ReactNode } from "react";
import { loadContent, t } from "../src/lib/content.ts";

export async function generateMetadata() {
  const c = await loadContent();
  return { title: t(c, "seo.title"), description: t(c, "seo.description") };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
