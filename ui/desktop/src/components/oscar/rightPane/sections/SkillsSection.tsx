// Sprint 20-M5 (ADR-086): Skills section body. Lists every skill in scope
// for the active area (bundled plugins via practiceAreas.bundled_skill_sources
// × on-disk SKILL.md presence, plus user-added skills under ~/.agents/skills/).
// Polls oscar:skills:list every 2 s via usePanelReader.
//
// Sprint 20-M6 (ADR-087): drop affordance. Drag a SKILL.md onto the zone
// → IPC stages it under ~/.agents/skills/<slug>/SKILL.md → renderer deep-
// links Forge to #/forge?reviewSkill=<absPath>.
//
// Sprint 28 M3 (ADR-093): the M5 tri-mode pill is dropped. Each row is a
// per-skill on/off toggle; default-on by inheritance from the existing
// 'all' mode in profile.json. Mirrors Tools (M2).
//
// Sprint 29 M4 (ADR-097): split into two zones — "In this matter" (enabled
// only, surface) + "All skills" (everything, collapsed directory).
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRightPaneCoords } from '../RightPaneContext';
import { usePanelReader } from './usePanelReader';
import { SECTION_META, type PanelSectionProps } from './registry';
import type { SkillEntry, SkillMode, SkillsListResult } from '../../../../preload';

const RESUME_TOOLTIP = 'Applies on next matter open';

const SKILL_FILE_EXT = '.md';

// Mirror main.ts:1866 safeSlug regex; pre-flight reject before IPC.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function deriveSlug(filename: string): string | null {
  if (!filename.toLowerCase().endsWith(SKILL_FILE_EXT)) return null;
  const stem = filename.slice(0, -SKILL_FILE_EXT.length);
  if (stem.length === 0 || stem.length > 64) return null;
  if (!SLUG_RE.test(stem)) return null;
  return stem;
}

export default function SkillsSection({ sectionId }: PanelSectionProps) {
  const meta = SECTION_META[sectionId];
  const navigate = useNavigate();
  const { areaId } = useRightPaneCoords();
  const { data, error } = usePanelReader<SkillsListResult>(
    async () => {
      if (!areaId) return { mode: 'all' as SkillMode, skills: [] };
      return window.electron.skills.list(areaId);
    },
    [areaId],
  );
  const skills = data?.skills ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [staging, setStaging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStage = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const slug = deriveSlug(file.name);
      if (!slug) {
        setStageError(
          `${file.name}: filename must be <kebab-slug>.md (lowercase a–z, 0–9, hyphens).`,
        );
        return;
      }
      setStageError(null);
      setStaging(true);
      try {
        const content = await file.text();
        const res = await window.electron.skills.stageForReview(slug, content);
        if (!res.ok) {
          setStageError(`${file.name}: ${res.message}`);
          return;
        }
        navigate(
          `/forge?reviewSkill=${encodeURIComponent(res.absPath)}`,
          { state: { disableAnimation: true } },
        );
      } catch (err) {
        setStageError(
          `${file.name}: ${(err as Error).message ?? 'Unknown error'}`,
        );
      } finally {
        setStaging(false);
      }
    },
    [navigate],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      void handleStage(e.dataTransfer?.files ?? null);
    },
    [handleStage],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const onToggle = useCallback(
    async (skill: SkillEntry) => {
      if (!areaId) return;
      setBusy(`slug:${skill.slug}`);
      setOpError(null);
      try {
        const res = await window.electron.skills.toggle(
          areaId,
          skill.slug,
          !skill.enabled,
        );
        if (!res.ok) setOpError(`${skill.slug}: ${res.message}`);
      } finally {
        setBusy(null);
      }
    },
    [areaId],
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

  const enabledSkills = skills.filter((s) => s.enabled);
  const surfaceEmpty = enabledSkills.length === 0;
  const [directoryOpen, setDirectoryOpen] = useState(false);
  // Auto-open the directory when the surface is empty so the lawyer
  // sees what's available without an extra click. Closing manually
  // sticks for the rest of the render until the surface fills.
  const [userClosedWhileEmpty, setUserClosedWhileEmpty] = useState(false);
  useEffect(() => {
    if (!surfaceEmpty) setUserClosedWhileEmpty(false);
  }, [surfaceEmpty]);
  const directoryExpanded =
    directoryOpen || (surfaceEmpty && !userClosedWhileEmpty);
  const onToggleDirectory = useCallback(() => {
    const next = !directoryExpanded;
    setDirectoryOpen(next);
    if (!next && surfaceEmpty) setUserClosedWhileEmpty(true);
  }, [directoryExpanded, surfaceEmpty]);

  return (
    <section className="oscar__panel-section" data-section-id={sectionId}>
      <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-title">
        {meta.title}
      </span>
      <div className="oscar__panel-section-body">
        {opError && (
          <p className="oscar__skills-error" data-testid="skills-error">
            {opError}
          </p>
        )}
        <div className="oscar__skills-zone" data-testid="skills-surface-zone">
          <span className="oscar__eyebrow oscar__eyebrow--bare oscar__skills-zone-title">
            In this matter
          </span>
          {surfaceEmpty ? (
            <p className="oscar__skills-empty" data-testid="skills-surface-empty">
              No skills enabled for this matter.
            </p>
          ) : (
            <ul className="oscar__skills-list" data-testid="skills-surface-list">
              {enabledSkills.map((s) => (
                <SkillRow
                  key={s.slug}
                  skill={s}
                  busy={busy === `slug:${s.slug}` || busy === `delete:${s.slug}`}
                  onToggle={() => void onToggle(s)}
                  onDelete={() => void onDelete(s)}
                  variant="surface"
                />
              ))}
            </ul>
          )}
        </div>
        <div className="oscar__skills-zone" data-testid="skills-directory-zone">
          <button
            type="button"
            className="oscar__skills-directory-toggle"
            data-testid="skills-directory-toggle"
            aria-expanded={directoryExpanded}
            onClick={onToggleDirectory}
          >
            <span className="oscar__eyebrow oscar__eyebrow--bare oscar__skills-zone-title">
              All skills {directoryExpanded ? '−' : '+'}
            </span>
          </button>
          {directoryExpanded && (
            <>
              <div
                className="oscar__skills-drop"
                data-testid="skills-dropzone"
                onDragOver={onDragOver}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Drop a SKILL.md or click to browse"
                aria-busy={staging}
              >
                {staging
                  ? 'Staging…'
                  : 'Drop a SKILL.md — or click to browse.'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md"
                  style={{ display: 'none' }}
                  onChange={(e) => void handleStage(e.target.files)}
                  data-testid="skills-file-input"
                />
              </div>
              {stageError && (
                <p className="oscar__skills-upload-error" data-testid="skills-stage-error">
                  {stageError}
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
                      busy={busy === `slug:${s.slug}` || busy === `delete:${s.slug}`}
                      onToggle={() => void onToggle(s)}
                      onDelete={() => void onDelete(s)}
                      variant="directory"
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

interface SkillRowProps {
  skill: SkillEntry;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  variant: 'surface' | 'directory';
}

function SkillRow({ skill, busy, onToggle, onDelete, variant }: SkillRowProps) {
  const showBundledTag = variant === 'directory' && skill.bundled;
  const showDelete = variant === 'directory' && skill.source === 'user';
  const showDescription = variant === 'directory' && Boolean(skill.description);
  return (
    <li
      className="oscar__skills-row"
      data-testid={`skills-row-${skill.slug}`}
      data-source={skill.source}
      data-variant={variant}
      title={skill.slug}
    >
      <div className="oscar__skills-name-block">
        <span className="oscar__skills-name">{skill.name}</span>
        {showBundledTag && (
          <span className="oscar__skills-tag" data-testid="skills-bundled-tag">
            [bundled]
          </span>
        )}
      </div>
      {showDescription && (
        <p className="oscar__skills-description">{skill.description}</p>
      )}
      <button
        type="button"
        className="oscar__skills-chip"
        data-testid="skills-chip"
        aria-pressed={skill.enabled}
        disabled={busy}
        title={RESUME_TOOLTIP}
        onClick={onToggle}
      >
        {skill.enabled ? 'On' : 'Off'}
      </button>
      {showDelete && (
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
