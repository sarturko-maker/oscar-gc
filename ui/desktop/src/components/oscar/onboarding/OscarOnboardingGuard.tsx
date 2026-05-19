import { useMemo, useState, type ReactNode } from 'react';
import OscarOnboardingView from './OscarOnboardingView';
import RecipeSecretsModal from './RecipeSecretsModal';
import { buildOnboardingRecipe } from './onboardingRecipe';
import { profileNeedsReIntake, useOscarProfile } from '../hooks/useOscarProfile';

interface Props {
  children: ReactNode;
}

const POLL_MS = 1500;

export default function OscarOnboardingGuard({ children }: Props) {
  const { profile, isLoading } = useOscarProfile({ pollMs: POLL_MS });
  // Sprint 16 (ADR-057, ADR-058): on first launch, scan the onboarding
  // recipe for declared env_keys and prompt the user for any that are
  // unset. The RecipeSecretsModal short-circuits if all keys are already
  // set (env var or keyring) or skipped previously, so this is a no-cost
  // gate on subsequent launches.
  const [secretsConfirmed, setSecretsConfirmed] = useState(false);

  const onboardingRecipe = useMemo(
    () =>
      buildOnboardingRecipe({
        resourcesRoot: window.electron.oscarResourcesRoot,
      }),
    [],
  );

  if (isLoading) {
    return null;
  }

  // No profile → first launch onboarding. Gate the view behind the
  // secrets modal so any required env_keys (e.g. TAVILY_API_KEY) are in
  // the keyring before the session spawns.
  if (!profile) {
    if (!secretsConfirmed) {
      return (
        <RecipeSecretsModal
          recipe={onboardingRecipe}
          onComplete={() => setSecretsConfirmed(true)}
        />
      );
    }
    return <OscarOnboardingView />;
  }

  // Sprint 15 (ADR-051): v2 profile read-time-migrated to a v3 stub with
  // captured_via="needs-re-intake". Route back into onboarding so the new
  // P2-P9 intake runs against this user. The new intake overwrites the
  // stub on finalize_profile.
  if (profileNeedsReIntake(profile)) {
    if (!secretsConfirmed) {
      return (
        <RecipeSecretsModal
          recipe={onboardingRecipe}
          onComplete={() => setSecretsConfirmed(true)}
        />
      );
    }
    return <OscarOnboardingView />;
  }

  return <>{children}</>;
}
