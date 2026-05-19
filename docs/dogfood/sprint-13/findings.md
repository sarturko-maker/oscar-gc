# Sprint 13 Crostini dogfood — findings

Date: 2026-05-19. Findings raised by Arturs after installing the first Sprint 13 draft-release `.deb` on Crostini and exercising Forge / Commercial / Privacy. P-priority following the Sprint 7 / 8 / 10 convention.

## P0 — RESOLVED in-sprint

### P0-A — Vendored MCP ESM bundle had duplicate shebang; Node rejected with SyntaxError; oscar-fs failed to load → Forge had no FS tools, Commercial would have lost matter-folder scope too

Regression introduced by `cd5b251da` (Sprint 13 Phase 6 fix for top-level await in `@modelcontextprotocol/server-filesystem@2026.1.14`). The switch to `format: 'esm'` was correct, but the `banner: { js: '#!/usr/bin/env node' }` config was left in place. esbuild's CJS mode strips the source's shebang; ESM mode preserves it. Result: `oscar-fs/index.js` shipped with two `#!/usr/bin/env node` lines, and Node rejected the file with `SyntaxError: Invalid or unexpected token` at line 2.

Symptom Arturs reported: Forge claims only `platform__manage_schedule` is available; reports "no file system access. The OSCAR tools (read_file, write_file, etc.) aren't loaded." Same regression would have broken every practice area's `oscar-fs` matter scope (ADR-041), so Commercial's redline batch and the lawyer-shape verification would have failed in the live dogfood the same way.

Fix: `bc2e601a5` drops the banner from `prepareVendoredMcps`. Rebuilt .deb uploaded to the same draft release `oscar-gc-sprint13` with `--clobber`. Verified the bundled `oscar-fs/index.js` boots: `Secure MCP Filesystem Server running on stdio` to stderr, then waits — the expected MCP-stdio handshake.

Reinstall on Crostini:

```
gh release download oscar-gc-sprint13 --repo sarturko-maker/goose -p '*.deb' --clobber
sudo dpkg -i oscar-gc_1.34.0_amd64.deb
```

## P2 — Sprint 14 candidates (UX scope; outside Sprint 13)

### P2-A — Forge sidebar slot alignment

Forge sits "just below the three dashes at the top and clashes." The `OscarSidebar.tsx` header zone introduced in Sprint 12 (ADR-039) has a layout collision with the existing 3-dot/3-dash element above the practice-area list. Likely a CSS spacing issue (margin, padding, or vertical-rhythm gap) that worked in isolated screenshot but doesn't survive real installation. Fix is small but visual — needs CSS review of the sidebar header zone vs. the topmost decorative element.

### P2-B — In-house framing: "Client" is wrong; counterparty isn't always external

`NewMatterDialog`'s field set assumes external-counsel framing (Client, Counterparty, Matter type). For in-house counsel:

- **Commercial** — work is with suppliers, vendors, consumers, partners, distributors, internal business units. "Client" defaults to the lawyer's own company; "Counterparty" is the relevant external entity. Both fields read wrong.
- **Privacy** — work is regulatory (data subject requests, DPIAs, vendor data-processing agreements, regulator inquiries). "Client" doesn't apply; even "Counterparty" is misleading for a DPIA on an internal product.
- **Other areas** — Employment (internal HR), IP (internal R&D), Disputes (counterparty as defendant/claimant), etc.

Two questions Arturs implicitly raises:
- **Are `client` / `counterparty` / `matter_type` wired to analytics, or are they just LLM context?** → Just LLM context today. They appear in `matter.md` frontmatter, get loaded into Top of Mind (ADR-044), and render in the sidebar matter list. No analytics consumer. So we can change the schema without breaking anything.
- **What's the right per-area mental model?** Sprint 14 needs to redesign `NewMatterDialog` per-area: field set + labels conditioned on `area.id`. Commercial: Internal client (BU), Counterparty (external entity), Matter type (NDA / MSA / SaaS terms / vendor agreement / dispute / etc.). Privacy: Subject (data subject / vendor / regulator / internal product), Matter type (DSR / DPIA / vendor DPA / regulator inquiry / breach / consent / training). Employment: Subject (employee / candidate / role), Matter type (offer / termination / grievance / investigation / policy). Litigation: Adverse party (claimant / defendant / regulator), Matter type. Etc.

This is the right Sprint 14 anchor — touches the matters data model, the recipe shape, the Top of Mind injection, and 13 area-specific dialog flavours.

### P2-C — Matter list re-access is hidden behind clicking the practice-area name twice

Once a matter is open, the only path back to the matter list is clicking the practice area in the sidebar again. No back-arrow / breadcrumb / "All matters" link in the chat surface. Sprint 14 candidate: add a `← All matters` affordance in the chat header (mirroring back-button patterns elsewhere in Goose, e.g., `BackButton.tsx`).

### P2-D — No higher-level grouping (client / vendor profile → many matters)

Real in-house workload often has multiple matters per counterparty / vendor / business unit. Today matters are flat under a practice area. Arturs is asking: where does the higher-level abstraction live?

Two ways forward (Sprint 14 design decision):
- (i) **A "client" or "counterparty" or "stakeholder" level above matter** in the data model — `~/.config/oscar/state/<area-id>/stakeholders/<slug>/matters/...`. More structure; more state to maintain.
- (ii) **Stakeholder as a tag/group on matters** — keep matters flat in the filesystem; group/sort in the UI by a `stakeholder` field on each matter. Less structural change; simpler.

(ii) is the smaller change; recommend Sprint 14 prototypes that first. Either way: also clarifies "where are matter folders created" — they live under `~/.config/oscar/state/<area-id>/matters/<slug>/` per ADR-036; document this in the matter-create dialog so users understand.

### P2-E — Privacy NewMatterDialog mental-model mismatch (specific instance of P2-B)

Privacy work is regulatory, not transactional. The dialog needs:
- Data subject / vendor / regulator / internal product as the "who"
- Matter type from a privacy-specific list (DSR, DPIA, vendor DPA, regulator inquiry, breach, etc.)
- Optional regulator (ICO, CNIL, BfDI, DPC, etc.) field for regulator-touching matters
- Optional legal basis field where the work hinges on lawful basis

Same shape needed per-area for the other 12. Folded into P2-B.

## What this means for Sprint 13's close

- **P0-A is the only blocker.** Re-installing the new .deb unblocks the lawyer-shape redline dogfood that Sprint 13 was originally about.
- **P2-A through P2-E are Sprint 14+ UX work** that doesn't affect whether Sprint 13's redline goal is met. They land in TODO.md as Sprint 14 candidates with P2-B as the load-bearing anchor (per-area matter-create flow).
- **Sprint 13's lawyer-shape close** still rides on: re-install → Commercial agent opens against a real NDA → six criteria from `lawyer-shape-criteria.md` pass → sign-off recorded.
