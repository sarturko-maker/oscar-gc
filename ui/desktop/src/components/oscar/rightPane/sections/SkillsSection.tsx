// Sprint 20-M5 (ADR-086): Skills section body. Three-segment mode pill
// (All / Allow / Deny) + one row per skill in scope for the active area
// (bundled plugins via practiceAreas.bundled_skill_sources × on-disk
// SKILL.md presence, plus user-added skills under ~/.agents/skills/).
// Polls oscar:skills:list every 2 s via usePanelReader — same shape M4's
// PlaybooksSection uses. Mode change + per-slug toggle persist to
// area_overrides.enabled_skills; resume semantics on next matter-open
// (ADR-085) surfaced via chip tooltip.
import { useCallback, useState } from 'react';
import { useRightPaneCoords } from '../RightPaneContext';
import { usePanelReader } from './usePanelReader';
import { SECTION_META, type PanelSectionProps } from './registry';
import type { SkillEntry, SkillMode, SkillsListResult } from '../../../../preload';

const RESUME_TOOLTIP = 'Applies on next matter open';

const MODE_LABEL: Record<SkillMode, string> = {
  all: 'All',
  allow: 'Allow',
  deny: 'Deny',
};

export default function SkillsSection({ sectionId }: PanelSectionProps) {
  const meta = SECTION_META[sectionId];
  const { areaId } = useRightPaneCoords();
  const { data, error } = usePanelReader<SkillsListResult>(
    async () => {
      if (!areaId) return { mode: 'all' as SkillMode, skills: [] };
      return window.electron.skills.list(areaId);
    },
    [areaId],
  );
  const mode: SkillMode = data?.mode ?? 'all';
  const skills = data?.skills ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const onSetMode = useCallback(
    async (next: SkillMode) => {
      if (!areaId || next === mode) return;
      setBusy(`mode:${next}`);
      setOpError(null);
      try {
        const res = await window.electron.skills.setMode(areaId, next);
        if (!res.ok) setOpError(res.message);
      } finally {
        setBusy(null);
      }
    },
    [areaId, mode],
  );

  const onToggleSlug = useCallback(
    async (skill: SkillEntry) => {
      if (!areaId || mode === 'all') return;
      // In allow mode: chip-pressed === in-slugs; toggle to flip membership.
      // In deny mode:  chip-pressed === NOT in-slugs; toggle to flip membership.
      const included = mode === 'allow' ? !skill.enabled : skill.enabled;
      setBusy(`slug:${skill.slug}`);
      setOpError(null);
      try {
        const res = await window.electron.skills.toggleSlug(
          areaId,
          skill.slug,
          included,
        );
        if (!res.ok) setOpError(`${skill.slug}: ${res.message}`);
      } finally {
        setBusy(null);
      }
    },
    [areaId, mode],
  );

  const onDelete = useCallback(
    async (skill: SkillEntry) => {
      if (!areaId || skill.bundled) return;
      setBusy(`delete:${skill.slug}`);
      setOpError(null);
      try {
        const res = await window.electron.skills.delete(areaId, skill.slug);
        if (!res.ok) setOpError(`${skill.slug}: ${res.message}`);
      } finally {
        setBusy(null);
      }
    },
    [areaId],
  );

  return (
    <section className="oscar__panel-section" data-section-id={sectionId}>
      <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-title">
        {meta.title}
      </span>
      <div className="oscar__panel-section-body">
        <SkillsModePill mode={mode} busy={busy} onSetMode={onSetMode} />
        {opError && (
          <p className="oscar__skills-error" data-testid="skills-error">
            {opError}
          </p>
        )}
        {skills.length === 0 ? (
          <p className="oscar__skills-empty" data-testid="skills-empty">
            {error
              ? `List failed: ${error.message}`
              : 'No skills available for this area.'}
          </p>
        ) : (
          <ul className="oscar__skills-list" data-testid="skills-list">
            {skills.map((s) => (
              <SkillRow
                key={s.slug}
                skill={s}
                mode={mode}
                busy={
                  busy === `slug:${s.slug}` || busy === `delete:${s.slug}`
                }
                onToggle={() => void onToggleSlug(s)}
                onDelete={() => void onDelete(s)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface SkillsModePillProps {
  mode: SkillMode;
  busy: string | null;
  onSetMode: (next: SkillMode) => void;
}

function SkillsModePill({ mode, busy, onSetMode }: SkillsModePillProps) {
  const isBusy = busy?.startsWith('mode:') ?? false;
  return (
    <div
      className="oscar__skills-mode-pill"
      data-testid="skills-mode-pill"
      role="group"
      aria-label="Skill scope mode"
    >
      {(['all', 'allow', 'deny'] as const).map((m) => (
        <button
          key={m}
          type="button"
          className="oscar__skills-mode-pill-segment"
          data-testid={`skills-mode-${m}`}
          aria-pressed={mode === m}
          disabled={isBusy}
          title={RESUME_TOOLTIP}
          onClick={() => void onSetMode(m)}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

interface SkillRowProps {
  skill: SkillEntry;
  mode: SkillMode;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function SkillRow({ skill, mode, busy, onToggle, onDelete }: SkillRowProps) {
  return (
    <li
      className="oscar__skills-row"
      data-testid={`skills-row-${skill.slug}`}
      data-source={skill.source}
    >
      <div className="oscar__skills-name-block">
        <span className="oscar__skills-name">{skill.name}</span>
        {skill.bundled && (
          <span className="oscar__skills-tag" data-testid="skills-bundled-tag">
            [bundled]
          </span>
        )}
      </div>
      {skill.description && (
        <p className="oscar__skills-description">{skill.description}</p>
      )}
      <button
        type="button"
        className="oscar__skills-chip"
        data-testid="skills-chip"
        aria-pressed={skill.enabled}
        aria-disabled={mode === 'all'}
        disabled={busy || mode === 'all'}
        title={RESUME_TOOLTIP}
        onClick={onToggle}
      >
        {mode === 'all' ? 'All allowed' : 'Allow'}
      </button>
      {skill.source === 'user' && (
        <button
          type="button"
          className="oscar__skills-delete"
          data-testid="skills-delete"
          aria-label={`Delete ${skill.slug}`}
          disabled={busy}
          onClick={onDelete}
        >
          ×
        </button>
      )}
    </li>
  );
}
