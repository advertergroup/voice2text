import { LegalPage } from "../../src/ui/legal.tsx";
export const dynamic = "force-dynamic";
export default function Page() { return LegalPage({ titleKey: "legal.privacy.title", bodyKey: "legal.privacy.body" }); }
