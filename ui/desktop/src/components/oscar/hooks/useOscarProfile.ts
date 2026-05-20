import { useEffect, useRef, useState } from 'react';
import type { PracticeArea } from '../practiceAreas';
import type { PanelSectionId } from '../rightPane/sections/registry';

// Sprint 20 (ADR-067): per-area overrides persisted in profile.json as the
// durable surface for Forge-driven agent edits. Schema-version-4 addition.
// M0 wires description_override end-to-end; later sprints wire the rest:
// M2 panel_sections (now PanelSectionId[]), M4 playbooks, M5 enabled_skills,
// M7 enabled_mcps. Remaining string-array fields stay permissive until their
// sprint narrows them to enums (per ADR-070's pattern).
export interface OscarAreaOverrides {
  description_override?: string;
  panel_sections?: PanelSectionId[];
  enabled_skills?: { mode: 'all' | 'allow' | 'deny'; slugs: string[] };
  enabled_mcps?: { mode: 'all' | 'allow' | 'deny'; ids: string[] };
  playbooks?: { always_on: string[]; on_demand: string[] };
}

// Sprint 19 P4 (ADR-066 D4): Forge-created practice areas capture an entry
// noun on profile.json (bundled areas use the shape's entryNoun, not this).
// Sprint M2 (ADR-070) reads this field in the section-composition fall-through
// when no PRACTICE_AREA_SHAPES entry exists for the area.
export interface OscarUserProfilePracticeArea extends PracticeArea {
  area_profile?: Record<string, string> | null;
  area_overrides?: OscarAreaOverrides;
  entry_noun?: { singular: string; plural: string } | null;
}

// Sprint 15 (ADR-051): schema v3 company_context block. Optional on the
// renderer-facing type so v1/v2 profiles (read pre-migration via
// `oscar:read-profile` raw JSON) still parse — but in practice the
// onboarding-mcp store's read() migrates them to v3 with captured_via
// set to "needs-re-intake".
export interface OscarCompanyContext {
  industry: {
    sector: string | null;
    sub_sector: string | null;
    business_model: string | null;
  };
  geography: {
    hq_jurisdiction: string | null;
    operating_jurisdictions: string[];
    customer_jurisdictions: string[] | null;
    employee_jurisdictions: string[] | null;
  };
  regulatory_baseline: {
    frameworks: Array<{
      id: string;
      label: string;
      confidence: 'user-confirmed' | 'tavily+user-confirmed' | 'llm-hypothesis-only';
    }>;
    captured_via:
      | 'hypothesis-confirm'
      | 'user-enumerated'
      | 'tavily-failed-llm-fallback'
      | 'needs-re-intake';
  };
  recurring_matters: { top_shapes: string[] };
  stakeholders: {
    reports_to: string | null;
    key_business_partners: string[];
    escalation_threshold_label: string | null;
  };
  risk_appetite: 'conservative' | 'balanced' | 'growth-oriented' | null;
  open_notes: string | null;
}

export interface OscarUserProfile {
  schema_version: 1 | 2 | 3 | 4;
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
  company_context?: OscarCompanyContext;
  practice_areas: OscarUserProfilePracticeArea[];
  provider: {
    kind: string;
    model: string;
  };
}

export function profileNeedsReIntake(profile: OscarUserProfile | null): boolean {
  if (!profile) return false;
  return profile.company_context?.regulatory_baseline?.captured_via === 'needs-re-intake';
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
