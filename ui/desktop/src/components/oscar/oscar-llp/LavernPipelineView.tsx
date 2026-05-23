// Sprint 24-B (ADR-079): Lavern Pipeline launch view. Doc picker + invoke
// button at /oscar-llp/pipeline. Mounted via App.tsx route. Reads from the
// user's lavern-pipeline working dir (~/Documents/Oscar GC/Oscar LLP/
// lavern-pipeline/), lets the user pick one or more docs, then builds the
// pipeline recipe and opens a session.
//
// No resume-on-existing for Sprint 24-B — pipeline invocations are ephemeral
// (per-run analysis, no persistent session binding). Mirrors quick-chat
// shape rather than matter or partner shape. If a session-binding need
// emerges (e.g., long-running portfolio analysis the user steps away from),
// add a per-run bind in a follow-up sprint.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../../../sessions';
import { AppEvents } from '../../../constants/events';
import { errorMessage } from '../../../utils/conversionUtils';
import { useConfig } from '../../ConfigContext';
import { useOscarProfile } from '../hooks/useOscarProfile';
import { deriveEnabledPlatformExtensions } from '../recipe/enabledPlatformExtensions';
import { buildLavernPipelineRecipe } from './buildLavernPipelineRecipe';

interface PipelineDir {
  workingDir: string;
  precedentsDir: string;
}

interface PipelineDoc {
  name: string;
  path: string;
}

export default function LavernPipelineView() {
  const navigate = useNavigate();
  const config = useConfig();
  const { profile } = useOscarProfile();
  const [dir, setDir] = useState<PipelineDir | null>(null);
  const [docs, setDocs] = useState<PipelineDoc[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ensured = await window.electron.llp.pipeline.ensureDir();
        if (cancelled) return;
        if (!ensured.ok) {
          setError('Failed to provision Lavern Pipeline working directory.');
          setLoading(false);
          return;
        }
        setDir({ workingDir: ensured.workingDir, precedentsDir: ensured.precedentsDir });
        const listed = await window.electron.llp.pipeline.listRecentDocs();
        if (cancelled) return;
        setDocs(listed.docs);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, 'Failed to load Lavern Pipeline working directory'));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const run = async () => {
    if (!dir || selected.size === 0) return;
    setOpening(true);
    setError(null);
    try {
      await window.electron.matters.detachActive();
      const enabledPlatformExtensions = deriveEnabledPlatformExtensions(config.extensionsList);
      const recipe = buildLavernPipelineRecipe({
        docPaths: Array.from(selected),
        workingDir: dir.workingDir,
        precedentsDir: dir.precedentsDir,
        resourcesRoot: window.electron.oscarResourcesRoot,
        user: profile?.user ?? null,
        corporate: profile?.corporate ?? null,
        companyContext: profile?.company_context ?? null,
        enabledPlatformExtensions,
      });
      const session = await createSession(dir.workingDir, { recipe });
      window.dispatchEvent(
        new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
          detail: { sessionId: session.id, initialMessage: undefined },
        })
      );
      navigate(`/pair?resumeSessionId=${encodeURIComponent(session.id)}`, {
        state: { disableAnimation: true },
      });
    } catch (err) {
      setError(errorMessage(err, 'Failed to start pipeline run'));
      setOpening(false);
    }
  };

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 min-h-0 py-12">
        <div className="oscar__eyebrow">Oscar LLP</div>
        <h1 className="oscar__matters-title">Lavern Pipeline</h1>
        <p className="oscar__matters-body">
          A multi-stage contract-analysis pipeline. The Watchman classifies each document and
          decides whether it warrants deep review; the Reader runs per-clause analysis with a
          template tuned to the document type and verifies grounding; for portfolios of two or
          more documents, the Curator surfaces cross-document patterns.
        </p>
        {dir && (
          <p className="oscar__matters-body mt-2 text-sm opacity-70">
            Drop documents into <code>{dir.workingDir}</code>, then pick which to analyse.
          </p>
        )}

        {loading && <p className="oscar__matters-empty mt-8">Loading documents…</p>}
        {error && <p className="oscar__matters-error mt-4">{error}</p>}

        {!loading && docs.length === 0 && (
          <p className="oscar__matters-empty mt-8">
            No documents yet. Drop .txt, .md, .pdf, or .docx files into the working folder shown
            above, then return here.
          </p>
        )}

        {!loading && docs.length > 0 && (
          <>
            <div className="oscar__matters-list flex flex-col mt-6 overflow-y-auto min-h-0">
              {docs.map((doc) => (
                <label
                  key={doc.path}
                  className="oscar__matter-row w-full text-left flex items-center justify-between gap-4 py-4 px-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(doc.path)}
                    onChange={() => toggle(doc.path)}
                    disabled={opening}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="oscar__matter-row-name truncate">{doc.name}</span>
                    <div className="oscar__matter-row-meta truncate">{doc.path}</div>
                  </div>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={run}
              disabled={selected.size === 0 || opening}
              className="oscar__btn-primary mt-6 self-start"
            >
              {opening
                ? 'Starting pipeline…'
                : `Run Lavern Pipeline on ${selected.size} document${selected.size === 1 ? '' : 's'}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
