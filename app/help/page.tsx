import { LegalPage } from "../../src/ui/legal.tsx";
export const dynamic = "force-dynamic";
export default function Page() { return LegalPage({ titleKey: "legal.help.title", bodyKey: "legal.help.body", contactKey: "contact.email" }); }
