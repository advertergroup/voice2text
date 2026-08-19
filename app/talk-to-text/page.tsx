import { cookies } from "next/headers";
import { loadContent, t, getLocale } from "../../src/lib/content.ts";
import { getCurrentUser } from "../../src/auth/session.ts";
import { Nav, Footer } from "../../src/ui/site.tsx";
import { MicRecorder } from "../../src/ui/MicRecorder.tsx";
import { localePath } from "../../src/lib/locale.ts";
import { ui } from "../../src/lib/ui.ts";
import { ANON_COOKIE, esPagado, quotaAgotada } from "../../src/lib/funnel.ts";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = await getLocale();
  if (locale === "es") return {
    title: "Hablar a Texto — Dicta con tu voz y conviértela en texto | Voice2Text",
    description: "Convierte tu voz en texto al instante: pulsa el micrófono, habla y descarga la transcripción en TXT, DOCX, PDF o SRT. Más de 90 idiomas.",
  };
  return {
    title: "Talk to Text — Speak & Convert Your Voice to Text Online | Voice2Text",
    description: "Free talk to text online: tap the mic, speak, and get an instant transcription. Download as TXT, DOCX, PDF or SRT. 90+ languages, nothing to install.",
  };
}

export default async function TalkToText() {
  const locale = await getLocale();
  const c = await loadContent(locale);
  const user = await getCurrentUser();
  const s = ui(locale);

  const anon = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  const quota = user?.subStatus !== "ACTIVE" && await quotaAgotada(user?.id ?? null, anon);
  const quotaCtaHref = esPagado(user) ? "/api/account/upgrade" : "/pay";
  const quotaTexts = { title: s.quota_title!, desc: s.quota_desc!, cta: s.quota_cta!, later: s.quota_later! };
  const micTexts = { tap: s.mic_tap!, recording: s.mic_recording!, stop: s.mic_stop!, again: s.mic_again!, start: s.mic_start!, uploading: s.mic_uploading!, denied: s.mic_denied! };

  const steps = [["steps.s2"], ["steps.s3"]];

  return (
    <>
      <Nav c={c} user={user} locale={locale} />
      <div className="hero" style={{ paddingBottom: 30 }}>
        <div className="container">
          <h1>{s.tt_h1}</h1>
          <p className="sub">{s.tt_sub}</p>
          <MicRecorder t={micTexts} quotaLocked={quota} quotaTexts={quotaTexts} quotaCtaHref={quotaCtaHref} lang={locale} />
          <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>
            {s.tt_or} <a href={localePath(locale, "/")} style={{ color: "var(--accent)", fontWeight: 600 }}>{s.tt_upload}</a>
          </p>
        </div>
      </div>

      <section className="alt">
        <div className="container">
          <h2 className="section-title">{t(c, "feat.title")}</h2>
          <div className="section-sub"></div>
          <div className="grid g4">
            {[["⚡", "feat.f1"], ["🌍", "feat.f2"], ["📄", "feat.f3"], ["🔒", "feat.f4"]].map(([ico, k]) => (
              <div className="card" key={k}>
                <div className="ico">{ico}</div>
                <h3>{t(c, `${k}.title`)}</h3>
                <p>{t(c, `${k}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer c={c} locale={locale} />
    </>
  );
}
