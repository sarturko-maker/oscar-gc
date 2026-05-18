# ADR-028 — No telemetry prompt; data sharing non-negotiable

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

Sprint 10's first Crostini dogfood confronted the user with upstream Goose's `TelemetryConsentPrompt` modal — a tick-box to opt in to anonymous usage analytics. CLAUDE.md's new doctrine ("inverting upstream UX defaults") points at exactly this kind of surface: upstream's defaults assume a developer audience where opt-in analytics is reasonable; Oscar GC's audience is in-house lawyers who handle privileged information for which data sharing is non-negotiable.

The brief was unambiguous: "Remove entirely. Not opt-out, not default-off-with-prompt — screen and tick box both go."

Three options were considered:

1. **Flip `TELEMETRY_UI_ENABLED` to false.** The prompt's first effect is an early-return on that flag; the modal never renders. Smallest diff. Leaves the component file + imports + render call intact.
2. **Remove the render call + import in App.tsx.** Modal cannot mount even if the flag flips back. Component file stays as upstream-tracked code; we just don't reach it.
3. **Delete `TelemetryConsentPrompt.tsx`.** Hardest to reverse; conflicts with future upstream merges of the same file.

## Decision

(1) **and** (2). Set `TELEMETRY_UI_ENABLED = false` in `ui/desktop/src/updates.ts` (defense in depth — any other code that gates on the flag also stops). Remove the `import` and the `<TelemetryConsentPrompt />` render in `ui/desktop/src/App.tsx`. Additionally, **hardcode telemetry off** at the analytics-init seam in `ui/desktop/src/renderer.tsx`: instead of reading the user's saved preference and calling `setTelemetryEnabled(savedValue)`, always call `setTelemetryEnabled(false)`. No code path can re-enable telemetry without an explicit source edit.

`TelemetryConsentPrompt.tsx` itself is **kept** as upstream-tracked code (option 3 declined) — easier to merge upstream patches to the file when we don't have to re-resolve a deletion conflict every release cycle.

## Rationale

- **Doctrine application.** CLAUDE.md "Inverting upstream UX defaults" mandates that where upstream's developer-audience defaults conflict with our in-house-legal audience, we invert. Telemetry is the canonical case.
- **Defense in depth.** A future component might gate on `TELEMETRY_UI_ENABLED`. Flipping that flag prevents the surface from re-appearing. Removing the render call prevents one specific surface even if the flag flips. Hardcoding `setTelemetryEnabled(false)` in renderer.tsx kills the network-call path even if some other component sneaks tracking back in.
- **No "opt-out hidden in settings" either.** Upstream might add a settings panel to flip telemetry back on. Sprint 11+ should audit the settings surfaces and remove any opt-in/opt-out path. Captured as a Sprint 11 carry-forward.
- Declined (3): deleting upstream-tracked files compounds merge cost. Keep the file, neutralise it.

## Consequences

- **No telemetry prompt** on first launch or after upgrade.
- **No telemetry network calls** in the runtime — `setTelemetryEnabled(false)` makes `track*` functions in `utils/analytics.ts` no-ops.
- **Upstream merge cost** for the App.tsx import/render block: a comment marker (`Sprint 10 (ADR-028): TelemetryConsentPrompt removed`) makes the change discoverable on conflict.
- **Sprint 11 carry-forward**: audit the `SettingsView` and child components for any user-facing toggle that would re-enable telemetry. The flag is off; a settings UI that flips it on would still surface privacy-relevant choices to the user. Either hide the toggle or make it always-off-and-disabled.
- **Documentation**: INSTALL_CROSTINI.md doesn't need a "no telemetry" callout — the inversion is the default, not a feature to mention.

## Supersedes

None. First ADR applying the CLAUDE.md "inverting upstream UX defaults" doctrine to a concrete surface.
