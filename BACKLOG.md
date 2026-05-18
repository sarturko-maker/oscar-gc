# Oscar GC — Backlog

Carry-forwards and deferred items that don't slot neatly into the next sprint.
Each entry: source sprint, rough priority, and a one-line description of the
remaining work. This file is append-only during a sprint; entries are closed
(struck through or removed) when they land in a sprint.

Sprint-specific carry-forwards live in `SPRINT_LOG.md` under the relevant
sprint entry. This file captures items with unclear scheduling or items that
span multiple sprints.

---

## Functional

| Item | From | Est. sprint |
|---|---|---|
| Commercial chat doesn't load on click; chat history surface missing. Hypothesis: ADR-029 `recordRecipeHash` short-circuit interacts with `BaseChat.tsx:218` await, or unrelated regression. Diagnose via `~/.cache/oscar-gc/launch.log`. | Sprint 10 | 12 |
| `oscar-memory` recipe wiring — MCP is bundled in the .deb but `commercialRecipe.ts` does not activate it. Wire into Commercial recipe and verify round-trip. | Sprint 5 | 12+ |
| ~~onboarding → practice-area pacing. Transition too abrupt. Sprint 7 P1-B.~~ Closed in Sprint 11 (P3.5 + pacing reshape in `systemPrompt.ts`). | Sprint 7 | done |
| Sprint 11 dogfood — Arturs's Chromebook install + verification (build .deb, install on Crostini, run onboarding + load one skill per kept area + Commercial redline round-trip). | Sprint 11 | 12 |

## UX / Visual

| Item | From | Est. sprint |
|---|---|---|
| MCP tool-call cards render too large in chat surface. Visual tweak to the upstream tool-rendering component. | Sprint 10 | 12 |
| ~~Markdown rendering in onboarding (emphasis, bold, lists) not applied in chat.~~ Closed in Sprint 11 (`OscarChatMessage.tsx` uses `MarkdownContent` for agent-variant turns). | Sprint 7 | done |
| System-prompt polish: Markdown emphasis, defined-term capitalisation, Clause 8 mutuality reminder in the redline agent's persona. | Sprint 9 | 12 |
| Conversation history clarity — matters-scoped containers for session history. | Sprint 8 | 12 |

## Branding

| Item | From | Est. sprint |
|---|---|---|
| Top-right Goose mascot — round 2. `GooseLogo` swap (ADR-030) missed three call sites that import `<Goose>` directly: `BaseChat.tsx:411`, `SessionsInsights.tsx:155,248`, `OnboardingGuard.tsx:157,190`. Neutralise `components/icons/Goose.tsx` or replace those imports. | Sprint 10 | 12 |
| App-icon raster pipeline. Regenerate `.png` / `.ico` / `.icns` from the LQ mark SVG. Options: `apt install librsvg2-bin`, npm `sharp`, or Python `cairosvg` from the bundled venv. | Sprint 10 | 12 |
| Settings page — audit for user-visible telemetry re-enable toggle. ADR-028 hardcoded telemetry off; if `SettingsView` still exposes a toggle, hide or disable it. | Sprint 10 | 12 |
| `goose://` URL scheme rebrand. Atomic change: `forge.config.ts schemes:` + both `.desktop` `MimeType=` + every `src/` consumer. Also wraps the `OnboardingGuard` "Welcome to goose" literal. | Sprint 2 | unscheduled |
| `document.title` runtime overwrite — React resets title to "Goose" after first render. Multiple call sites (`grep -r "document.title" ui/desktop/src/`). | Sprint 2 | unscheduled |
| System prompt self-identification — `crates/goose/src/prompts/system.md` introduces the agent as "Goose". First legitimate `crates/` touch; needs ADR. | Sprint 2 | unscheduled |
| Launcher icon still upstream Goose in Crostini App Drawer (deferred from Sprint 10 icon.png/ico/icns swap). | Sprint 10 | 12 |

## Packaging / Distribution

| Item | From | Est. sprint |
|---|---|---|
| postinst orphan on uninstall — `/usr/lib/oscar-gc/oscar-gc-launcher.sh` written by postinst is not tracked by dpkg. Add `prerm` / `postrm` to remove on `apt remove`. | Sprint 10 | 12 |
| Matter-workspace stubs — 9 kept inert in Sprint 11 bundled library (self-disable for in-house). Retire when Sprint 12 Matters/Projects layer lands. | Sprint 11 | 12 |
| macOS / Windows artefacts — not Arturs's target, but required before any external pilot. | Sprint 10 | unscheduled |
| Flatpak / AppImage for Linux outside Crostini. | Sprint 10 | unscheduled |

## Architecture

| Item | From | Est. sprint |
|---|---|---|
| Sprint 15+: migrate ADR-029's title-prefix short-circuit (`recipe.title.startsWith('Oscar GC')`) to a proper `recipe.metadata.bundled` flag when community recipes open. Requires extending the Recipe schema in `ui/desktop/src/api/` + updating BaseChat + preload. | Sprint 10 | 15+ |
| Forge meta-agent + Matters/Projects scoped containers. | Sprint 8 | 12 |
| Community skills tier — user-installed extensions from external sources. | Sprint 8 | 15+ |
