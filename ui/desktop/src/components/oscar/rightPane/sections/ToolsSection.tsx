// Sprint 28 M2 (ADR-092): Tools section body. Lists MCPs the agent has
// access to for this matter — bundled-for-area (always-on, read-only)
// and per-area installed integrations (toggleable). Mirrors SkillsSection
// shape sans the tri-mode pill — every tool is a per-row on/off toggle.
import { useCallback, useState } from 'react';
import { useRightPaneCoords } from '../RightPaneContext';
import { usePanelReader } from './usePanelReader';
import { SECTION_META, type PanelSectionProps } from './registry';
import type { ToolEntry, ToolsListResult } from '../../../../preload';

const RESUME_TOOLTIP = 'Applies on next matter open';

export default function ToolsSection({ sectionId }: PanelSectionProps) {
  const meta = SECTION_META[sectionId];
  const { areaId } = useRightPaneCoords();
  const { data, error } = usePanelReader<ToolsListResult>(
    async () => {
      if (!areaId) return { tools: [] };
      return window.electron.tools.list(areaId);
    },
    [areaId],
  );
  const tools = data?.tools ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const onToggle = useCallback(
    async (tool: ToolEntry) => {
      if (!areaId || tool.source === 'bundled') return;
      setBusy(tool.id);
      setOpError(null);
      try {
        const res = await window.electron.tools.toggle(
          areaId,
          tool.id,
          !tool.enabled,
        );
        if (!res.ok) setOpError(`${tool.displayName}: ${res.message}`);
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
        {opError && (
          <p className="oscar__tools-error" data-testid="tools-error">
            {opError}
          </p>
        )}
        {tools.length === 0 ? (
          <p className="oscar__tools-empty" data-testid="tools-empty">
            {error
              ? `List failed: ${error.message}`
              : 'No tools available for this area.'}
          </p>
        ) : (
          <ul className="oscar__tools-list" data-testid="tools-list">
            {tools.map((t) => (
              <ToolRow
                key={t.id}
                tool={t}
                busy={busy === t.id}
                onToggle={() => void onToggle(t)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface ToolRowProps {
  tool: ToolEntry;
  busy: boolean;
  onToggle: () => void;
}

function ToolRow({ tool, busy, onToggle }: ToolRowProps) {
  const isBundled = tool.source === 'bundled';
  return (
    <li
      className="oscar__tools-row"
      data-testid={`tools-row-${tool.id}`}
      data-source={tool.source}
    >
      <div className="oscar__tools-name-block">
        <span className="oscar__tools-name">{tool.displayName}</span>
        {isBundled && (
          <span className="oscar__tools-tag" data-testid="tools-bundled-tag">
            [bundled]
          </span>
        )}
      </div>
      {tool.description && (
        <p className="oscar__tools-description">{tool.description}</p>
      )}
      <button
        type="button"
        className="oscar__tools-chip"
        data-testid="tools-chip"
        aria-pressed={tool.enabled}
        aria-disabled={isBundled}
        disabled={busy || isBundled}
        title={isBundled ? 'Bundled — always on' : RESUME_TOOLTIP}
        onClick={onToggle}
      >
        {isBundled ? 'Always on' : tool.enabled ? 'On' : 'Off'}
      </button>
    </li>
  );
}
