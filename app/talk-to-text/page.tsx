import { cookies } from "next/headers";
import { loadContent, t, getLocale } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { Nav, Footer } from "../../src/ui/site.tsx";
import { MicRecorder } from "../../src/ui/MicRecorder.tsx";
import { Uploader } from "../../src/ui/Uploader.tsx";
import { Pasos, Caracteristicas, Modos } from "../../src/ui/Secciones.tsx";
import { localePath } from "../../src/lib/locale.ts";
import { ui } from "../../src/lib/ui.ts";
import { ANON_COOKIE, esPagado, quotaAgotada } from "../../src/lib/funnel.ts";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = await getLocale();
  const c = await loadContent(locale);
  const brand = t(c, "brand.name");
  if (locale === "es") return {
    title: `Hablar a Texto — Dicta con tu voz y conviértela en texto | ${brand}`,
    description: "Convierte tu voz en texto al instante: pulsa el micrófono, habla y descarga la transcripción en TXT, DOCX, PDF o SRT. Más de 90 idiomas.",
  };
  return {
    title: `Talk to Text — Speak & Convert Your Voice to Text Online | ${brand}`,
    description: "Free talk to text online: tap the mic, speak, and get an instant transcription. Download as TXT, DOCX, PDF or SRT. 90+ languages, nothing to install.",
  };
}

export default async function TalkToText() {
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const s = ui(locale);
  const reg = user ? "/dashboard" : localePath(locale, "/register");

  const anon = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  const quota = user?.subStatus !== "ACTIVE" && await quotaAgotada(user?.id ?? null, anon);
  const quotaCtaHref = esPagado(user) ? "/api/account/upgrade" : "/pay";
  const quotaTexts = { title: s.quota_title!, desc: s.quota_desc!, cta: s.quota_cta!, later: s.quota_later! };
  const micTexts = { tap: s.mic_tap!, recording: s.mic_recording!, stop: s.mic_stop!, again: s.mic_again!, start: s.mic_start!, uploading: s.mic_uploading!, denied: s.mic_denied! };

  return (
    <>
      <Nav c={c} user={user} locale={locale} />

      {/* Hero del dictado: mismo formato que la home, con el micro de protagonista
          y la tarjeta de subir archivo/URL justo debajo. */}
      <div className="hero" style={{ paddingBottom: 30 }}>
        <div className="container">
          <h1>{s.tt_h1}</h1>
          <p className="sub">{s.tt_sub}</p>
          {/* UNA sola tarjeta: micro arriba, separador «or» y archivo/URL debajo */}
          <div className="upcard" style={{ maxWidth: 660, margin: "0 auto", textAlign: "center", padding: "30px 22px 8px" }}>
            <MicRecorder t={micTexts} quotaLocked={quota} quotaTexts={quotaTexts} quotaCtaHref={quotaCtaHref} lang={locale} bare />

            <div aria-hidden style={{ display: "flex", alignItems: "center", gap: 14, margin: "24px 0 0", color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>
              <span style={{ height: 1, flex: 1, background: "var(--border)" }} />
              {s.tt_or}
              <span style={{ height: 1, flex: 1, background: "var(--border)" }} />
            </div>

            <Uploader dropzoneText={t(c, "hero.dropzone")} selectText={t(c, "hero.selectFiles")} quotaLocked={quota} quotaTexts={quotaTexts} quotaCtaHref={quotaCtaHref}
              s={s} bare />
          </div>
          <div className="badges" style={{ marginTop: 16, justifyContent: "center", display: "flex" }}><span>{t(c, "hero.formats")}</span></div>
        </div>
      </div>

      {/* Mismo cuerpo que la home: pasos ilustrados, características, modos y CTA */}
      <Pasos c={c} locale={locale} reg={reg} />
      <Caracteristicas c={c} />
      <Modos c={c} />

      <section>
        <div className="container">
          <div className="cta-band">
            <h2>{t(c, "cta.title")}</h2>
            <p>{t(c, "cta.subtitle")}</p>
            <a href={reg} className="btn btn-lg">{t(c, "cta.button")}</a>
          </div>
        </div>
      </section>

      <Footer c={c} locale={locale} />
    </>
  );
}
