import { type ReactNode } from 'react';
import OscarOnboardingView from './OscarOnboardingView';
import { useOscarProfile } from '../hooks/useOscarProfile';

interface Props {
  children: ReactNode;
}

const POLL_MS = 1500;

export default function OscarOnboardingGuard({ children }: Props) {
  const { profile, isLoading } = useOscarProfile({ pollMs: POLL_MS });

  if (isLoading) {
    return null;
  }

  if (!profile) {
    return <OscarOnboardingView />;
  }

  return <>{children}</>;
}
