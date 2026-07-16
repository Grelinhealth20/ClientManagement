import ProviderIntake from "@/components/onboarding/ProviderIntake";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Provider Onboarding — Grelin Health",
  robots: { index: false, follow: false },
};

// Public, token-gated page. No session required — access is granted by the
// token in the URL plus the security key the provider enters.
export default function ProviderIntakePage({ params }) {
  return <ProviderIntake token={params.token} />;
}
