// Sprint 16 (ADR-058): generic gate for recipe-declared env_keys.
//
// On first launch (or any time a recipe with declared `env_keys` is about
// to spawn a session), scans the recipe via /recipes/scan_secrets, checks
// each required key against Goose's secret config (env var first then
// keyring), and prompts the user for any that are unset. Save → writes
// the value into the keyring via upsertConfig(is_secret:true). Skip →
// writes a non-secret OSCAR_<KEY>_SKIPPED=true flag so the next launch
// doesn't re-prompt.
//
// Closes the docs-vs-code gap that Goose itself has: the recipe-reference
// docs describe this prompt; the Rust core (merge_environments) silently
// skips with a warn!() instead. This component plus the new goose-server
// /recipes/scan_secrets route + the lifted goose::recipe::secret_discovery
// module make the documented behaviour true on the desktop.

import { useEffect, useMemo, useState } from 'react';
import { scanRecipeSecrets } from '../../../api';
import type { Recipe, SecretRequirement } from '../../../api';
import { useConfig } from '../../ConfigContext';
import { SecureStorageNotice } from '../../settings/providers/modal/subcomponents/SecureStorageNotice';
import { Button } from '../../ui/button';

interface Props {
  recipe: Recipe;
  onComplete: () => void;
}

type ScanState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; missing: SecretRequirement[] };

export default function RecipeSecretsModal({ recipe, onComplete }: Props) {
  const { read, upsert } = useConfig();
  const [scan, setScan] = useState<ScanState>({ kind: 'loading' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await scanRecipeSecrets({
          body: { recipe },
          throwOnError: true,
        });
        const secrets = response.data?.secrets ?? [];

        if (secrets.length === 0) {
          if (!cancelled) onComplete();
          return;
        }

        const missing: SecretRequirement[] = [];
        for (const secret of secrets) {
          // Goose's get_secret reads env (uppercase) first, then keyring.
          // A masked-but-non-null value means the key is set; null means
          // unset and needs prompting. If the user previously skipped this
          // key on first launch, OSCAR_<KEY>_SKIPPED=true means do not
          // re-prompt — treat as "user opted out".
          const skippedFlag = await read(`OSCAR_${secret.key}_SKIPPED`, false);
          if (skippedFlag === true || skippedFlag === 'true') {
            continue;
          }
          const existing = await read(secret.key, true);
          if (existing === null || existing === undefined) {
            missing.push(secret);
          }
        }

        if (cancelled) return;

        if (missing.length === 0) {
          onComplete();
          return;
        }

        setScan({ kind: 'ready', missing });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setScan({ kind: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
    };
    // recipe is intentionally not in the dep array: this gate runs once
    // per render of OscarOnboardingGuard and the recipe is stable for that
    // render. Re-running on recipe identity changes would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missing = useMemo(
    () => (scan.kind === 'ready' ? scan.missing : []),
    [scan],
  );

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      for (const secret of missing) {
        const v = values[secret.key]?.trim() ?? '';
        if (v.length > 0) {
          await upsert(secret.key, v, true);
        } else {
          await upsert(`OSCAR_${secret.key}_SKIPPED`, true, false);
        }
      }
      onComplete();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleSkipAll = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      for (const secret of missing) {
        await upsert(`OSCAR_${secret.key}_SKIPPED`, true, false);
      }
      onComplete();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  if (scan.kind === 'loading') {
    return (
      <div className="oscar oscar__chat-shell">
        <div className="oscar__eyebrow oscar__chat-shell-eyebrow">Oscar // Setup</div>
        <div className="oscar__chat-status">Checking required keys…</div>
      </div>
    );
  }

  if (scan.kind === 'error') {
    return (
      <div className="oscar oscar__chat-shell">
        <div className="oscar__eyebrow oscar__chat-shell-eyebrow">Oscar // Setup</div>
        <div className="oscar__chat-status oscar__chat-status--error">
          Could not check recipe secrets: {scan.message}
        </div>
        <div className="mt-4">
          <Button onClick={onComplete}>Continue anyway</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="oscar oscar__chat-shell">
      <div className="oscar__eyebrow oscar__chat-shell-eyebrow">Oscar // Setup</div>
      <div className="p-4 border rounded-xl bg-background-muted max-w-xl">
        <h3 className="font-medium text-text-default mb-2">
          {missing.length === 1
            ? 'One extension needs a key'
            : `${missing.length} extensions need keys`}
        </h3>
        <p className="text-xs text-text-muted mb-4">
          These keys are required by extensions in your onboarding recipe. They are
          stored in your system keyring and read by Goose at session start. Leave
          a field blank to skip — that extension will fall back to a no-key path
          (e.g. the intake skips web search and uses model knowledge only).
        </p>

        <div className="flex flex-col gap-4">
          {missing.map((secret) => (
            <div key={secret.key}>
              <label className="text-sm font-medium text-text-default">
                {secret.key}
              </label>
              <p className="text-xs text-text-muted mt-1 mb-2">
                Required by <span className="font-medium">{secret.extension_name}</span>{' '}
                extension.
              </p>
              <input
                type="password"
                value={values[secret.key] ?? ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [secret.key]: e.target.value }))
                }
                placeholder="Paste your key here"
                className="w-full px-3 py-2 border rounded bg-background-default text-text-default"
                autoComplete="off"
                disabled={submitting}
              />
            </div>
          ))}
        </div>

        <SecureStorageNotice className="mt-3" />

        {submitError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800 text-sm">
            {submitError}
          </div>
        )}

        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="ghost" onClick={handleSkipAll} disabled={submitting}>
            Skip all
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save and continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
