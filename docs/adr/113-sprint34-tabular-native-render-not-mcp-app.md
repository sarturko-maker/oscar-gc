# ADR-113 — Sprint 34 Tabular Review: native React split surface, not an MCP App

Status: accepted
Date: 2026-05-28
Sprint: 34

## Context

The brief said the grid should be "rendered via the Apps extension." But the load-bearing user
requirement is that a lawyer works the **grid and the agent simultaneously** — add a column or
re-run a cell in conversation while reading the grid and drilling a citation. Goose's MCP App host
(`ui/desktop/src/components/McpApps/McpAppRenderer.tsx`, `useDisplayMode.ts`) renders a server-supplied
HTML resource in a **sandboxed iframe** anchored to a chat tool-call, with display modes
`inline | fullscreen | pip | standalone` — no shipped side-by-side mode (`sidecar` is a commented-out
example). User decision this session: native, not MCP App.

## Decision

Render the grid as **native React in a full-window split**: TanStack grid (ported from LQ-Grid's
React components, LQdesign-themed) as the centre canvas, the existing matter chat surface reused as a
docked **agent rail** (same session), and a cell-drill **citation panel** (LQ-Grid `SourceView` for
the offset-exact highlight + `@react-pdf-viewer`/`docx-preview` for the original). Mounted as a new
route on the Forge full-surface pattern (`App.tsx` `<Route path="forge" .../>`). A right-pane
"Tabular Review" section (3-edit `registry.ts` pattern + `usePanelReader`) is the durable, matter-
scoped re-entry point ([[ADR-083]]). State is the matter-folder manifest ([[ADR-111]]); the agent
mutates it via MCP tools; a 2s file poll re-renders.

## Rationale

- MCP App inline = a cramped grid scrolling inside the chat transcript; fullscreen = the chat is
  hidden. Neither gives comfortable grid-plus-agent at 50-contract scale.
- The sandboxed iframe cannot share React state with the host, so grid↔chat↔cell coupling would
  round-trip through postMessage/tool-calls, and the Editorial theme would be re-implemented inside
  the iframe.
- LQ-Grid's grid is **already React**, so native reuses *more* prior art than re-bundling it into an
  iframe HTML app would.

## Consequences

- We intentionally depart from the brief's literal "Apps extension" wording; this ADR records that
  call (it supersedes brief guidance, not a prior ADR).
- We forgo reuse of the MCP-App host for the grid; in exchange we get shared-state coupling, full
  theming, and direct grid interactions (edit/flag/override).
- Full-window is a native route for v1; a dedicated standalone Electron window
  (`StandaloneAppView`) is deferred unless the matter window proves too narrow.

Cites: [[ADR-083]], [[ADR-111]].
