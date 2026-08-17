import { LegalPage } from "../../src/ui/legal.tsx";
export const dynamic = "force-dynamic";
export default function Page() { return LegalPage({ titleKey: "legal.refund.title", bodyKey: "legal.refund.body", contactKey: "contact.email" }); }
