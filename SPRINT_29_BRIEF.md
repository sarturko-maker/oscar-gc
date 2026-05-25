# Sprint 29 — Brief

Sprint 28 shipped the right-panel polish (Edit-bug fix, Tools section, Skills
toggle simplification, visual polish, .deb to dogfood). Arturs ran the build on
Crostini and surfaced **five further issues + one bug** for Sprint 29 to take
on. He flagged that more comments will follow — this sprint addresses these
five first; the next-comments tranche becomes a follow-up brief.

## What Arturs said (verbatim, 2026-05-25 Crostini dogfood)

> (1) The edit button now goes right to forge. Users need to have a choice
> (it does not come naturally that you can just ask an agent to amend things)
> and users should be able to amend key facts in the matter and matter name
> manually and have an option to go to Forge (it should be available behind
> the edit button with a clear and brief explanation).
>
> (2) Tools are good — clear titles and explanations, while the skills are not
> — hard to understand what they are.
>
> (3) When you click to turn on one skill ALL of them turn on. that's wrong.
>
> (4) There is a "redlining" section that says coming soon — I am not sure
> what this is. Redlining is already a tool and Adeu can do it.
>
> (5) Are playbooks, skills, tools all wired up? For example, if I upload a
> playbook, the agent will have a choice to use it (it is in effect a skill
> just easier to understand for the users — you may have 10 playbooks uploaded
> NDA review, MSA and so forth and the agent needs to pick the right one).
>
> I will have more comments but let's deal with these first.

## The five issues

### 1. Edit needs a choice — manual edit OR open Forge

**What's there now.** The pane header "Edit" link routes directly to
`#/forge?modifyArea=<areaId>` (the Sprint 20-M7 deep-link). A lawyer who
doesn't already know "you can ask the agent to amend things" doesn't get the
opportunity to learn it from this affordance — clicking it just dumps them
into an agent chat with no orientation.

**What lawyers expect.** A way to edit matter facts (the dl-row values:
subject, counterparty, kind, stakeholder, privileged, key_facts, the matter
name itself) **manually** — typed into the same kind of form they used at
matter creation. Forge is a *power* path for when manual editing isn't enough
("rewrite the Commercial agent's description to include escalation
thresholds") — it should be visible behind the Edit button with a clear,
brief explanation of when to use it, not the only path.

**Why this matters.** The pane is the lawyer's window onto the matter. If
the Edit affordance routes only to an agent conversation, the pane stops
feeling like a *tool* and starts feeling like a *gateway to magic*. Manual
editing keeps the affordance grounded; Forge stays the option for the
conversational route. The introduction to Forge itself ("the meta-agent for
modifying your loadout") needs to land somewhere — in copy next to the
button, not implicit.

**Directional.** Think of Edit as a small split: a default "Edit matter
details" surface for the structured fields lawyers already understand
(matter.md / matter_overrides for area-level), and a clearly-labelled "Ask
Forge to change this area's loadout" entry inside that surface with a
one-sentence pitch. Where exactly the split lives (modal? expanded pane
section? new route?) is a design call — think deeply about it.

### 2. Skills don't read like tools — titles, descriptions, hierarchy

**What's there now.** Skills rows show the raw kebab-slug (`nda-review`,
`amendment-history`, `escalation-flagger`) as the name, with a faint
italic description below clamped to two lines. Bundled tag, On/Off chip.

**Why it fails.** A lawyer looking at "amendment-history" doesn't get a
quick read on *what it does*. The Tools section has clear titles
("Filesystem (matter scope)", "Document extraction", "Web search (Tavily)",
"Redlining (Adeu)") and a one-sentence description that lands. Skills
should match that bar.

**What's available.** The bundled `claude-for-legal` skills carry richer
frontmatter than the slug — name, description, sometimes argument hints.
Goose's slash-command surface (`/config/slash_commands`) exposes `help` text
that the current panel already reads. The data is there; the presentation
isn't.

**Directional.** Lift to the Tools-section level of clarity: a human title
(not the slug), a description that's actually legible (not 2-line clamped
italic faint serif), and consistent visual weight across Tools and Skills.
The slug can stay as a `data-attribute` for testing or live in a tooltip;
the human-facing surface is the title.

### 3. Toggling one skill turns ALL of them on — bug

**Symptom.** A lawyer clicks an Off skill to turn it On. Result: every
other skill they had off also flips On.

**Likely cause.** Sprint 28 M3 simplified the toggle to always-write the
deny-shape (`{ mode: 'deny', slugs: [...disabled] }`). The migration from
existing `mode: 'allow'` profiles is mishandled: the toggle code treats
`current.slugs` as "currently disabled" regardless of mode, but in `'allow'`
mode `current.slugs` are the *enabled* slugs. So the migration silently
inverts the meaning of every other slug — flipping one On rewrites the deny
list to one entry, which (under the new deny semantics) enables everything
else. Sprint 28's visual harness only covered the `mode: 'all'` → first
toggle path; the `'allow'` migration was untested.

**Directional.** Either preserve the existing mode shape on write
(`'allow'` stays `'allow'`, just edit the slug list with the right
semantics), or do a *correct* migration that needs the full skill universe
(`'allow' → 'deny'` needs to know every available skill in the area).
There's a third path — bake the migration into `oscar:skills:list` so the
read normalises on first call. Pick the one that's least surprising.

Whatever the fix, add a visual-verification step for the `mode: 'allow'`
starting state, not just `'all'`.

### 4. The "Redlining" panel section — redundant, remove

**What's there.** Commercial's `defaultPanelSections` includes a
`Redlining` entry that today renders as a `PanelSectionStub` with "coming
soon". The intent of the original master brief was a dedicated redline
surface (load Adeu output, accept/reject changes, etc.).

**Why it's wrong now.** "Redlining" is *already* surfaced as a Tool
("Redlining (Adeu)") in Sprint 28's new Tools section. A lawyer sees both
and reasonably asks "what's the difference?" There isn't one worth showing.

**Directional.** Drop `Redlining` from the closed PanelSectionId union and
from every area's `defaultPanelSections`. If a richer Redlining workflow
(diff preview / accept-reject) ever wants a home, it can re-earn a section
ID at that point. Same likely true for `Forum` and `Deadlines` stubs — if
they're not in scope, don't leave them in the closed enum advertising as
"coming soon".

### 5. End-to-end wiring check: playbooks, skills, tools

**What Arturs wants to know.** If a lawyer uploads a playbook (an .md or
.pdf with redline guidance, say "NDA-redline-playbook.md"), does the agent
actually use it on the next NDA matter? When there are 10 playbooks
uploaded across different document types, does the agent pick the right
one?

**What's in the architecture (Sprint 20-M4 / ADR-085).** Three layers:

- *Layer 1* — always-on. Lawyer marks a playbook always-on; renderer reads
  + extracts text + injects as `## Playbooks in scope` block in the recipe
  instructions. Capped at 8K chars per area.
- *Layer 2* — on-demand. Playbook stays on disk under
  `~/.config/oscar/playbooks/<scope>/`; oscar-fs's allowed-directories has
  been widened so the agent can read it via `oscar-fs__read_file` when the
  lawyer asks ("redline this NDA against our playbook"). Binary playbooks
  reach computercontroller's pdf_tool / docx_tool.
- *Layer 3* — semantic retrieval. Deferred. Would be the actual answer to
  "agent picks the right playbook from a corpus of 10" — embedding-based
  matching against matter context.

**What this sprint needs to confirm.** Run a real dogfood pass on each
wiring. Upload a playbook. Open a matter. Ask the agent a relevant
question. Observe whether the agent uses the playbook by name. Do it for
always-on and for on-demand separately. Record the conversation log.

**Where it likely falls short.** The "10 playbooks, agent picks the right
one" mental model is Layer 3 territory, which doesn't ship today. The
sub-question worth resolving in Sprint 29: with 10 playbooks present but
none always-on, does the *agent know they exist* and does it consult them?
If not, the on-demand layer needs a nudge — either a recipe-instructions
block listing available on-demand playbooks by filename + a one-line
purpose, or a stronger Layer 2 prompt scaffold. **Think deeply about this**
— the gap between Arturs's mental model and what Layer 2 delivers is the
load-bearing question of this sprint.

The skills-as-playbooks framing Arturs uses ("playbook is in effect a
skill, just easier for users to understand") suggests the polish target
isn't *new mechanism* but *make the existing on-demand path visible to the
agent and the lawyer*. Don't build Layer 3 in this sprint — that's a
separate body of work.

## Sprint shape

- Five fixes, each with its own milestone + Xvfb visual verification per
  Sprint 28's pattern. Issues 1, 2, 4 are scoped UI work. Issue 3 is a bug
  fix with a regression-test addition. Issue 5 is part inspection, part
  potentially a small wiring patch.
- Single .deb at sprint close for Arturs's Crostini hand-test.
- Per-milestone visual inspection by CC on lq-vps is mandatory — Arturs's
  Sprint 28 RULE carries forward.
- Numbered Sprint 29; ADRs allocated 094, 095, 096 if needed
  (single-decision-per-ADR per CLAUDE.md).

## Carry-forwards from Sprint 28 the new session should know

- `pnpm package` (the lighter dev rebuild path) fails until
  `ui/desktop/sub-recipes/` is copied to
  `ui/desktop/src/resources/sub-recipes/`. The full `bundle:oscar-linux`
  handles this via `prepare-oscar-bundle.js`. If iterating fast, copy once
  at session start.
- Two stale ADR references in code comments (`main.ts` Sprint 20-M8 line
  and `preload.ts` Sprint 27 line) point at non-existent ADRs 091/092 —
  unrelated to Sprint 28's actual ADR-091 / ADR-092 files. Cosmetic;
  cleanup is a one-line edit if anyone trips on it.
- Sprint 28 `.deb` lives at
  `ui/desktop/out/make/deb/x64/oscar-gc_1.34.0_amd64.deb`; draft release at
  `https://github.com/sarturko-maker/oscar-gc/releases/tag/untagged-239c2a2153b2e9795e1f`.
  If Sprint 29 supersedes before that's published, the draft can be
  deleted; otherwise Sprint 29's ship overwrites the same tag name pattern
  (`oscar-gc-sprint-29`).

## Out of scope for Sprint 29

Arturs's "I will have more comments" tranche. Hold the new comments for a
Sprint 30 brief.
