# ADR-030 — In-product LQ branding for Oscar GC chrome

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

Sprint 10 dogfood surfaced three in-product branding gaps after the renderer paint fix:

1. **Goose mascot still visible in chat chrome.** `GooseLogo` (a Rain-and-Goose composition) is used by `LoadingGoose` during chat state idle/streaming, by `suspense-loader`, and by `RecipeActivities`. Lawyers see "goose" everywhere the AI is "thinking."
2. **Settings affordance is unrouted.** The `/settings` route exists (`App.tsx`, `main.ts:1090`) but the rebrand removed every visible click target. Users cannot reach Settings from the main UI chrome.
3. **App launcher icon is still the Goose mascot.** `src/images/icon.png`, `icon.ico`, `icon.icns`, `icon-512.png` are upstream assets. Crostini's launcher (and ChromeOS Files preview) shows the Goose duck.

CLAUDE.md "inverting upstream UX defaults" applies to all three. Upstream's developer-audience defaults expose Goose-branded surfaces directly; Oscar GC's in-house-lawyer audience needs the LQ visual identity.

## Decision

Three sub-decisions, with one explicit carry-forward:

1. **`GooseLogo` body replaced with inline LQ mark SVG.** The component name is kept (so all upstream call sites — `LoadingGoose`, `suspense-loader`, `RecipeActivities` — automatically inherit the swap) but the body renders the LegalQuants `mark.svg` shape inline (cream rectangle, Cormorant Garamond `L`, copper italic `Q`, copper underscore rule). `Goose` and `Rain` icon imports removed.

2. **Settings affordance restored via the `OscarSidebar` footer.** A new `oscar__sidebar-footer` div hosts a utility-style link (mono caps, hairline-rule separator) linking to `/settings`. CSS classes added: `.oscar__sidebar-footer`, `.oscar__sidebar-item--utility`, `.oscar__sidebar-item-icon`. Active-state styling follows existing `.oscar__sidebar-item--active` conventions.

3. **App launcher icon raster swap deferred to Sprint 11.** Reason: the build host doesn't have a SVG→PNG converter installed (`rsvg-convert` / `convert` / `magick` / `inkscape` all absent), and the apt-install of `librsvg2-bin` was blocked by the auto mode classifier (the user did not authorize the package install). Sprint 10 ships the SVG (`icon.svg`) as the LQ mark for scalable contexts; `icon.png` / `icon-512.png` / `icon.ico` / `icon.icns` remain upstream until Sprint 11 lands a raster pipeline.

## Rationale

- **Single-source replacement on `GooseLogo`** rather than per-call-site removal: matches the pattern from ADR-028 (one neutralisation seam means upstream merges show as conflicts on one file). Lawyers never see the duck; LoadingGoose's chat-thinking indicator becomes the LQ mark.
- **Sidebar footer over a dedicated header bar**: the sidebar is the existing navigation chrome; adding a Settings link as a utility-styled footer matches the editorial-typography idiom (mono caps + copper accent) already in use elsewhere in Oscar GC. No new chrome surface introduced.
- **Icon raster deferred, not skipped**: the .deb's launcher icon is what Crostini's App Drawer shows. Until we have a working SVG→PNG converter on the build host, the asset can't be updated cleanly. Captured as a Sprint 11 carry-forward; both options (apt-install librsvg2-bin, or wire in `sharp` / Python `cairosvg`) are open.

## Consequences

- **Chat surfaces no longer show the Goose mascot.** Anywhere `GooseLogo` rendered (LoadingGoose's chat-state indicator, suspense loader, recipe-activities placeholder), the LQ mark appears instead.
- **Settings reachable from sidebar footer** in any practice-area or hub view. Active state styling differentiates the utility link from practice areas.
- **Launcher icon remains upstream Goose** until Sprint 11 closes the raster pipeline. Visible in Crostini App Drawer + Files-app preview. Carry-forward captured in SPRINT_LOG.
- **Upstream merge risk**: `GooseLogo.tsx` body diverged significantly from upstream. Future upstream edits to mascot styling won't apply; conflicts will be expected on every merge of that file. Acceptable trade-off — the component is small and its purpose is now product-branded.
- **`OscarSidebar.tsx`** has a new dependency on `lucide-react`'s `Settings` icon (already a project dep).

## Supersedes

None. First ADR on in-product LQ branding. Companion to ADR-025/026 (which handled the launch-time Crostini env) and ADR-028 (telemetry surface).
