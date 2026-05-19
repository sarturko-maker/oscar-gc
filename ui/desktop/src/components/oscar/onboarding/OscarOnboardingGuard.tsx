import { type ReactNode } from 'react';
import OscarOnboardingView from './OscarOnboardingView';
import { profileNeedsReIntake, useOscarProfile } from '../hooks/useOscarProfile';

interface Props {
  children: ReactNode;
}

const POLL_MS = 1500;

export default function OscarOnboardingGuard({ children }: Props) {
  const { profile, isLoading } = useOscarProfile({ pollMs: POLL_MS });

  if (isLoading) {
    return null;
  }

  // No profile → first launch onboarding.
  if (!profile) {
    return <OscarOnboardingView />;
  }

  // Sprint 15 (ADR-051): v2 profile read-time-migrated to a v3 stub with
  // captured_via="needs-re-intake". Route back into onboarding so the new
  // P2.5 — Company context block runs against this user. The new intake
  // overwrites the stub on finalize_profile.
  if (profileNeedsReIntake(profile)) {
    return <OscarOnboardingView />;
  }

  return <>{children}</>;
}
