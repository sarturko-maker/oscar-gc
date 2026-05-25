# ADR-099: On-demand playbook discovery block in recipe instructions

Sprint 29 M6 (2026-05-25). Status: Accepted. Extends ADR-085.

## Context

Crostini dogfood (2026-05-25): "If I upload a playbook, the agent will
have a choice to use it... You may have 10 playbooks uploaded — NDA
review, MSA — and the agent needs to pick the right one." The brief
flags Layer 3 (semantic retrieval) as out of scope but asks the
sub-question: with 10 playbooks present but none always-on, does the
agent know they exist and consult them?

Today's wiring (ADR-085):

- **Layer 1 (always-on).** Lawyer flips a playbook always-on; renderer
  extracts text + injects a `## Playbooks in scope` block into the
  recipe instructions (8 K char cap). Agent always sees it.
- **Layer 2 (on-demand).** `oscar-fs` allowed-directories includes
  `~/.config/oscar/playbooks/`; computercontroller carries pdf_tool +
  docx_tool. Agent *can* read these — but the system prompt never
  tells it which playbooks exist or how to find them. Discovery
  requires a directory listing the agent isn't prompted to perform.
- **Layer 3 (semantic).** Deferred. The "10-playbook pick-the-right-one"
  story sits here.

The gap: Layer 2 is wired but invisible. A non-always-on playbook
silently inhabits the filesystem; the agent answers as if it doesn't
exist.

## Decision

At recipe-build time the renderer prepends a second playbook block —
`## On-demand playbooks` — listing every non-always-on playbook
visible to the area, alongside the existing always-on `## Playbooks in
scope` block.

Per entry: relative path (so the agent can `oscar-fs__read_file` it
directly), filename, scope (global / area), and for text-format files
a peeked first-line hint (≤ 80 chars, first heading or first
non-blank line) as the one-line purpose. Binary formats list only the
filename + size — extracting their text at recipe build would double
the Layer 1 cost for every spawn, and the filename usually carries
enough signal.

Block is omitted when the area has zero on-demand playbooks. New IPC
`oscar:playbooks:render-on-demand-block(areaId, alwaysOn)` mirrors
the existing `render-block` surface; renderer wrapper
`renderOnDemandPlaybooksBlock` slots into `buildPracticeAreaRecipe`
between always-on Layer 1 and the skills block.

## Alternatives rejected

- **Extract all playbooks at recipe build (Layer 1-for-everything).**
  Multiplies Layer 1's cost by N. Goes against the 8 K cap discipline.
  Doesn't answer the "10 playbooks → right one" question (it just
  drowns the context in playbook text).
- **Build Layer 3 semantic retrieval.** Out of scope per brief.
- **Tell the agent to `oscar-fs__list_directory` first.** Adds a
  required tool call to every matter open and depends on the agent
  remembering. The static block is cheaper and always present.
- **Push discovery to the lawyer's prompt.** Brief is explicit:
  Arturs's mental model is "agent knows what's available". Make the
  agent know.

## Caveats

- A 10-playbook list adds ~10 lines to the recipe instructions. At
  ~80 chars per line that's well under any context budget.
- The first-line peek for `.md` files lands on the first markdown
  heading or comment. Authors who lead with a noisy comment get a
  noisy hint. Acceptable; the filename is the load-bearing signal.
- Binary playbooks (.pdf, .docx) show filename + size only. If a
  lawyer wants the agent to know "this PDF is the SaaS MSA
  checklist", they should name the file accordingly. Adding optional
  computercontroller extraction for binary purpose-hints is a future
  enhancement, not Sprint 29 scope.

Cites: ADR-040, ADR-084, ADR-085.
