import { requireSection } from "@/lib/clientAccess.js";
import { query } from "@/lib/db.js";
import { getSession } from "@/lib/auth.js";
import NoAccess from "@/components/NoAccess";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingHome() {
  const { user, denied } = await requireSection("onboarding");
  if (denied) return <NoAccess />;

  // The client code is tagged onto every folder/record and shown in the header.
  const session = await getSession();
  const [row] = await query(
    "SELECT client_code, name FROM clients WHERE id = :id LIMIT 1",
    { id: session.client_id }
  );

  return (
    <OnboardingWizard
      user={user}
      clientCode={row?.client_code || ""}
      clientName={row?.name || ""}
    />
  );
}
