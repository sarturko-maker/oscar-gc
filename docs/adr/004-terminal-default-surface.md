# ADR-004 — LQdesign Terminal as the default surface for Oscar GC

Status: accepted
Date: 2026-05-18
Sprint: 3

## Context

The LQdesign system (`/srv/projects/LQdesign/`) defines two surfaces sharing one brand:

- **Editorial** — cream paper, copper accents, Cormorant Garamond + Outfit + IBM Plex Mono. Designed for PDF reports, weekly digests, decks, press pieces. Fixed A4 layout (`210mm × 297mm`).
- **Terminal** — near-black `#08080D`, indigo `#6366F1` accent, Inter + JetBrains Mono. Designed for "legalquants.com, the cohort product, landing pages, dashboards" — i.e., product/web surfaces.

The Sprint 3 brief initially said "default to Editorial for the landing screen and capture as an ADR." Mid-planning that was corrected: Oscar GC is a desktop app, which is architecturally a product surface — Terminal's natural home. Editorial is print-only.

## Decision

The default LQdesign surface for the Oscar GC desktop application is **Terminal**. Sprint 3's landing-screen placeholder uses Terminal palette (near-black background, indigo accent, copper signature retained), Terminal typography (Inter for display + body, JetBrains Mono for metadata), and Terminal layout rules.

Editorial remains reserved for **exported artefacts** the product may later generate — for example, agent-produced legal memos exported to PDF. Editorial is not used inside the running desktop UI.

## Consequences

- Sprint 3 imports Terminal-only LQdesign tokens (`--night`, `--indigo-500`, `--glow-txt`, `--sans-product`, `--mono-product`, copper accents) into `ui/desktop/src/styles/main.css`.
- The copper signature (`--copper #9A3412`) and the signature serif (`Cormorant Garamond`) are retained as available tokens because LQdesign's README names them as the cross-surface brand hinge. Sprint 3's placeholder doesn't use them but future Terminal components may.
- Tokens are container-scoped under `.oscar-terminal` (not declared at `:root`) — see ADR-005. This keeps the surface adoption opt-in per component while we incrementally rebuild the UI.
- If a future practice area or feature needs an Editorial-styled surface inside the app (unlikely but possible — e.g., a "print preview" panel), that decision warrants its own ADR.

## Supersedes

None.
