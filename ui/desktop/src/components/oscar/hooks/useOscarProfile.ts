import { useEffect, useRef, useState } from 'react';
import type { PracticeArea } from '../practiceAreas';

export interface OscarUserProfilePracticeArea extends PracticeArea {
  area_profile?: Record<string, string> | null;
}

export interface OscarUserProfile {
  schema_version: 1 | 2;
  completed_at: string;
  user: {
    name: string | null;
    role: string;
    role_label: string;
  };
  corporate: {
    name: string | null;
    industry: string | null;
    size_band: string | null;
  };
  practice_areas: OscarUserProfilePracticeArea[];
  provider: {
    kind: string;
    model: string;
  };
}

export interface UseOscarProfileResult {
  profile: OscarUserProfile | null;
  isLoading: boolean;
}

export function useOscarProfile(options?: { pollMs?: number }): UseOscarProfileResult {
  const [profile, setProfile] = useState<OscarUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollMsRef = useRef(options?.pollMs ?? 0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const read = async (): Promise<void> => {
      const result = (await window.electron.readOscarProfile()) as OscarUserProfile | null;
      if (!active) return;
      setProfile(result);
      setIsLoading(false);
      if (pollMsRef.current > 0 && !result) {
        timer = setTimeout(read, pollMsRef.current);
      }
    };

    read();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { profile, isLoading };
}
