import { useMemo } from 'react';
import { useOscarProfile } from './useOscarProfile';
import { PRACTICE_AREAS, type PracticeArea } from '../practiceAreas';

export function usePracticeAreas(): readonly PracticeArea[] {
  const { profile } = useOscarProfile();
  return useMemo(() => {
    if (
      profile &&
      Array.isArray(profile.practice_areas) &&
      profile.practice_areas.length > 0
    ) {
      return profile.practice_areas;
    }
    return PRACTICE_AREAS;
  }, [profile]);
}
