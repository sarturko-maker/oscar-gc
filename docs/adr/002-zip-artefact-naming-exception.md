# ADR-002 — Zip artefact name `Oscar-GC-…`; binary slug `oscar-gc`

Status: accepted
Date: 2026-05-18
Sprint: 2

## Context

The Sprint 2 brief prescribed two naming forms:

- Human-readable display: `Oscar GC` (with space)
- Kebab-case slug for filenames, npm names, and paths: `oscar-gc`

The brief's example zip filename was `Oscar-GC-linux-x64-<version>.zip` — Title-Case-Hyphenated, neither pure display form (which would have a space) nor pure kebab-case slug. The example and the slug rule slightly conflict for this single artefact.

`ui/desktop/forge.config.ts` controls these via `packagerConfig.name` (output directory + zip filename) and `packagerConfig.executableName` (in-zip binary filename). Upstream Goose sets neither — both default to `productName` from `package.json`, which would produce `Oscar GC-linux-x64-1.34.0.zip` (with a space) and a binary named `Oscar GC` (with a space). Spaces in Linux artefact names are technically valid but operationally awkward.

## Decision

Add to `packagerConfig` in `ui/desktop/forge.config.ts`:

```ts
name: 'Oscar-GC',           // Title-Case-Hyphenated — drives output dir + zip filename
executableName: 'oscar-gc', // kebab-case — drives the in-zip Electron binary filename
```

The zip artefact is `Oscar-GC-linux-x64-1.34.0.zip`. The binary inside is `oscar-gc`. The macOS/Windows display name is still `Oscar GC` via `productName`.

## Consequences

- One named exception to the "kebab-case for filenames, npm names, and paths" convention: the zip filename itself is Title-Case-Hyphenated.
- Everything else stays kebab-case: in-zip binary (`oscar-gc`), npm package name (`oscar-gc-app`), deb/rpm `bin` (`oscar-gc`), install paths (`/usr/lib/oscar-gc/`), icon paths (`oscar-gc.png`), URL scheme handler MimeType target (`x-scheme-handler/goose` — see ADR-003 for why scheme stays).
- Future reviewer guidance: the zip is the only artefact that follows display-form-hyphenated; treat any other Title-Case file/path name as a regression.
- If we later ship `.deb` or `.rpm`, those artefact names are controlled by the maker `name` field (`'Oscar GC'`) and will produce different filename patterns — out of Sprint 2 scope but worth noting that the rule above is artefact-type-specific.

## Supersedes

None.
