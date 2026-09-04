import { LandingFull, landingMetadata } from "../../../src/ui/LandingFull.tsx";

export const dynamic = "force-dynamic";
const SLUG = "free-transcription"; // ruta espejo 1:1 de la competencia

export async function generateMetadata() { return landingMetadata(SLUG); }
export default function Page() { return <LandingFull slug={SLUG} />; }
