import { LandingFull, landingMetadata } from "../../../src/ui/LandingFull.tsx";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return landingMetadata(slug);
}

export default async function Landing({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LandingFull slug={slug} />;
}
