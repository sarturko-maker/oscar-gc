# ADR-027 — Resources-root detection moves to the main process

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

ADR-024 (Sprint 10) put the `oscarResourcesRoot` probe inside `preload.ts`: import `node:fs.existsSync`, check whether the packaged-resources tree contains the bundled CPython binary, expose the result to the renderer via `contextBridge.exposeInMainWorld`.

That was wrong. Electron's preload script runs in a **sandboxed context** (`sandbox: true` is the modern default, enforced by `contextIsolation: true` in `main.ts:847-869`). Sandboxed preload cannot import Node built-ins. First Crostini dogfood produced the captured failure (`docs/dogfood/sprint-10/` carry-forward):

```
Unable to load preload script: /usr/lib/oscar-gc/resources/app.asar/.vite/build/preload.js
Error: module not found: node:fs
Uncaught TypeError: Cannot read properties of undefined (reading 'logInfo')
```

Cascade: preload throws on the `node:fs` import → `contextBridge.exposeInMainWorld('electron', …)` never runs → `window.electron` is `undefined` in the renderer → every renderer call into `window.electron.<anything>` throws → React tree fails to mount → blank window + Gtk widget assertion as Chromium tries to draw a destroyed surface.

The renderer-can't-paint symptom Arturs reported across two .deb iterations was not a Crostini display issue. The launch flags from ADR-025/026 were unnecessary in spirit (though they remain useful for Crostini env hygiene and didn't cause harm). The actual problem was the preload import.

Two options for the fix:

1. **Disable preload sandbox** (`webPreferences.sandbox: false` or `nodeIntegrationInSubFrames: true`). Restores Node access to preload but is a security regression — sandboxed preload is the standard Electron threat-model surface for arm's-length renderer code.

2. **Move the probe to the main process** (which already has unrestricted Node access). Pass the resolved `oscarResourcesRoot` through to preload via the same `additionalArguments` config JSON that already carries `GOOSE_API_HOST`, `GOOSE_VERSION`, etc. Preload reads it from the parsed config object — no `node:fs` import, no sandbox break.

## Decision

Option (2). `main.ts:728-744` gains a `resolveOscarResourcesRoot()` helper that runs in the main process (Node-privileged); the result is added to the `appConfig` object as `OSCAR_RESOURCES_ROOT`. `preload.ts` reads it from the existing `config = JSON.parse(process.argv.find(...))` channel and exposes it as `window.electron.oscarResourcesRoot`, unchanged in shape from ADR-024's renderer-side contract.

## Rationale

- **Existing seam.** `additionalArguments` is already how main passes per-window initialization data to preload — no new IPC channel required.
- **No sandbox regression.** Preload stays pure-JS, no Node imports, no flags relaxed.
- **Same shape for the renderer.** The recipe factories (commercialRecipe.ts, onboardingRecipe.ts) and call sites (`OscarCommercialView.tsx`, `OscarOnboardingView.tsx`) read `window.electron.oscarResourcesRoot` exactly as ADR-024 specified. No call-site changes.
- **Dev fallback still works.** In `pnpm run start-gui`, `process.resourcesPath` doesn't contain the bundled CPython; `resolveOscarResourcesRoot()` returns `null`; preload exposes `null`; factories use the `/srv/projects/...` dev paths.
- **`OSCAR_RESOURCES_OVERRIDE` env var** still honoured (read in main).
- Declined (1): sandbox-off is a load-bearing security regression for a problem that has a clean alternative.

## Consequences

- **`ui/desktop/src/main.ts`** gains the `resolveOscarResourcesRoot` helper and one new `appConfig` field (`OSCAR_RESOURCES_ROOT`).
- **`ui/desktop/src/preload.ts`** drops the `node:fs` and `node:path` imports and the inline helper; replaces with a single `config.OSCAR_RESOURCES_ROOT ?? null` read.
- **Renderer-side contract unchanged.** `window.electron.oscarResourcesRoot: string | null` is the same field shape ADR-024 specified.
- **Other browser windows** (`main.ts:1179`, `main.ts:2650`) — these pass `JSON.stringify(appConfig)` directly to preload. Since `OSCAR_RESOURCES_ROOT` is in `appConfig`, those windows inherit it without additional plumbing.

## Supersedes

The implementation note in ADR-024 ("preload script does the existsSync probe synchronously"). Renderer-side contract unchanged; only the path of detection moves to the main process.
