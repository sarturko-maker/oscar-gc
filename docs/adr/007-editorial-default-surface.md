# ADR-007 — LQdesign Editorial as the default surface for Oscar GC

Status: accepted
Date: 2026-05-18
Sprint: 4.6

## Context

ADR-004 chose Terminal on the reasoning that Oscar GC is a desktop product and Terminal is "Linear × Vercel × Bloomberg" web-product styling. Sprint 4.5 implemented Terminal faithfully (Inter 900 hero, JetBrains Mono eyebrows, indigo orb behind the wordmark, indigo-tinted active state, JetBrains Mono `01–13` numeric prefixes). The build rendered correctly and matched the Terminal spec.

It did not look like LegalQuants.

A re-read of `/srv/projects/LQdesign/` against ADR-004's premise found:

- Every real-world LegalQuants surface in the folder is Editorial: `index.html` (the 4-page "10 Weeks of Legal Quants" report), `Masdar Proposal.html` (the Masdar Legal proposal), `lq-report.html` (the long report). All cream paper, Cormorant Garamond, Outfit, IBM Plex Mono, copper.
- Terminal's stated scope in the README is narrow: "legalquants.com, the cohort product, landing pages, dashboards" — the marketing-site surface for the *external* legalquants.com web property. There is no in-house-legal-product mockup anywhere in the design folder.
- The brand's described "hinge" is two elements: copper (`#9A3412`) and Cormorant Garamond. Sprint 4.5 left copper invisible and Cormorant loaded-but-unused. Both hinges were off-screen.
- The Terminal wordmark and the Editorial wordmark each use a *contrast moment* ("Legal" plain + "Quants" emphasized — indigo gradient in Terminal, italic copper in Editorial). Sprint 4.5 rendered "Oscar GC" as a monolithic Inter 900 block, missing the move.

ADR-004's premise (Oscar GC is a product surface ≈ Terminal) treats "product" as the load-bearing word. The re-read suggests "LegalQuants" is the load-bearing word: the brand's voice is Editorial, and the in-house-legal application should read as LegalQuants for in-house teams, not as a generic web dashboard.

## Decision

The default LQdesign surface for the Oscar GC desktop application is **Editorial**. Cream paper (`#FAF6F0`), Cormorant Garamond display, Outfit sans body, IBM Plex Mono labels, copper signature accent. Editorial applies across all product surfaces — Hub, sidebar, placeholder pages.

Concrete typography assignments:

- **Hero** — Cormorant Garamond 700, `clamp(72px, 9vw, 144px)`, with italic copper accent on the key word (mirrors LegalQuants' wordmark pattern). 48px × 3px copper rule beneath, per the `.ed-page-rule` precedent.
- **Section title / placeholder title** — Cormorant Garamond 600, 26px, `--ink`.
- **Body** — Outfit 400, 12px on dense surfaces / 14–16px on prose surfaces, `--ink-light`.
- **Eyebrow** — IBM Plex Mono 500, 9px, 0.2em tracking, uppercase, `--copper` (per `.ed-section-tag` and `.ed-eyebrow`).
- **Numerics / metadata** — IBM Plex Mono 500, 9–11px, `--ink-faint` or `--copper`.
- **Active state on sidebar** — copper-glow background, copper border-left, ink text, copper numeric.

Terminal tokens (`--night`, `--indigo-500`, the orb glow, JetBrains Mono) are removed from the product CSS scope. They remain available in `colors_and_type.css`-equivalent token definitions for any future Editorial-overlay-on-Terminal surface (e.g., if a dashboard view ever lands).

## Consequences

- Supersedes ADR-004.
- Class block `.oscar-terminal` is renamed to `.oscar`. The name no longer ties to a surface choice; the surface lives in the tokens, not the class name.
- Two new font families loaded via Google Fonts CDN matching Sprint 3's Inter precedent: **Outfit** (variable 300–700, Editorial body sans) and **IBM Plex Mono** (static 400/500/600, Editorial labels). Inter and JetBrains Mono remain loaded (already shipped) but are unused in product surfaces — kept available without removal cost.
- Cormorant Garamond moves from loaded-but-unused (Sprint 4.5 disposition) to load-bearing on hero and section-title surfaces.
- The seam (ADR-006) is unchanged. Everything reachable through `<OscarSidebar />` is ours; everything else is upstream-tracked.
- A future ADR may carve out a specific Terminal accent surface within Editorial structural shell (e.g., a dashboard panel, a logs view), but that decision is its own ADR at the time it surfaces.

## Supersedes

ADR-004 (LQdesign Terminal as the default surface for Oscar GC).
