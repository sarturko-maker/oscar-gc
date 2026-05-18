# ADR-024 — Resource path resolution at runtime

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

ADRs 022 (Python bundling) and 023 (Node + MCP bundling) put the runtime artefacts under the Electron app's `resources/` directory. At runtime these resolve to `${process.resourcesPath}/...` on a packaged install (e.g., `/opt/oscar-gc/resources/...` on Linux). The recipes (`commercialRecipe.ts`, `onboardingRecipe.ts`) import as TypeScript constants used by React components in the renderer process; renderer access to `process.resourcesPath` is gated by Electron's `contextIsolation`.

Three options:

1. **Build-time path injection** via Vite `define` — substitutes the absolute path at build time. Doesn't work: `resourcesPath` is determined at install time, not build time. The same `.deb` should run from any install prefix.
2. **IPC call** — renderer asks the main process for the path via `ipcRenderer.invoke`. Async; recipe construction becomes async; awkward at every call site.
3. **Preload `contextBridge` expose** — the preload script runs with privileged access to `process.resourcesPath` and synchronously exposes it to the renderer via `contextBridge.exposeInMainWorld`.

## Decision

Option (3). `ui/desktop/src/preload.ts` exposes `process.resourcesPath` synchronously to the renderer via `contextBridge`. Both recipes become factory functions (`buildCommercialRecipe(resourcesPath: string): Recipe`, `buildOnboardingRecipe(resourcesPath: string): Recipe`) that compute all extension `cmd:`/`args:` paths from the passed-in root.

Dev fallback: when running `pnpm run start-gui`, `process.resourcesPath` resolves to a path under the dev tree where bundled artefacts don't exist. Factories detect this and fall back to the existing `/srv/projects/...` absolute paths (`REDLINE_VENV_BIN`, `ONBOARDING_NODE_CMD`, `ONBOARDING_MCP_PATH`). Pattern mirrors `findGoosedBinaryPath` (`ui/desktop/src/goosed.ts:43-83`): packaged path first, env-var override (`OSCAR_RESOURCES_OVERRIDE`), dev fallback.

## Rationale

- preload is the canonical Electron seam for renderer-visible globals. Synchronous access keeps recipe construction as pure functions — no async ceremony at every call site, no Promise plumbing in `OscarCommercialView.tsx` / `App.tsx`.
- Factory pattern preserves ADR-008's "Recipe lives in TypeScript, one source of truth" decision. The factory IS the recipe; just parameterised.
- Dev fallback preserves the lq-vps workflow. Sprint 1-9 development continues unchanged; packaged builds resolve under `resourcesPath`.
- Mirrors the existing `findGoosedBinaryPath` precedent — packaged path first, dev fallback, env-var escape hatch. Familiar shape for future maintainers.

## Consequences

- Two existing call sites change: `OscarCommercialView.tsx` (currently imports `COMMERCIAL_RECIPE` directly) and the onboarding consumer (likely `App.tsx` near `OscarOnboardingGuard`). Each now reads `resourcesPath` from the preload bridge and calls `buildXRecipe(resourcesPath)`.
- preload script gains a new exposed field; corresponding `.d.ts` declaration for the renderer-side `window.electron` namespace must stay aligned. Upstream Goose's existing preload pattern is the reuse point.
- Factory functions are pure and easily tested with mocked paths; renderer-component tests that touch recipes need a `window.electron` stub.
- `OSCAR_RESOURCES_OVERRIDE` env var becomes the documented escape hatch (e.g., for testing a packaged build against an unpacked dev tree, or for debugging path resolution). Captured in RUNBOOK on first use.

## Supersedes

None.
