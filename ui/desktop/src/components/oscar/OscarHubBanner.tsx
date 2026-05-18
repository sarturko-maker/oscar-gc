import { useState } from 'react';
import { useOscarProfile } from './hooks/useOscarProfile';

const DISMISS_KEY = 'oscar.hubWelcomeDismissed';

export default function OscarHubBanner() {
  const { profile, isLoading } = useOscarProfile();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true',
  );

  if (dismissed || isLoading || !profile) {
    return null;
  }

  const firstName = profile.user.name?.trim().split(/\s+/)[0] ?? null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="oscar__banner" role="status" aria-live="polite">
      <div className="oscar__banner-body">
        <p className="oscar__banner-title">
          Welcome to Oscar GC
          {firstName && (
            <>
              , <span className="oscar__banner-title-em">{firstName}</span>
            </>
          )}
          .
        </p>
        <p className="oscar__banner-text">
          Your practice areas are listed in the sidebar — pick one to begin.
        </p>
      </div>
      <button
        type="button"
        className="oscar__banner-dismiss"
        onClick={dismiss}
        aria-label="Dismiss welcome message"
      >
        Dismiss
      </button>
    </div>
  );
}
