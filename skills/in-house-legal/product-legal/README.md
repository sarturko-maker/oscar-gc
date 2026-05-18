# Product Counsel Plugin

Product legal workflows: launch review, marketing claims review, feature risk assessment, and fast "is this a problem?" triage. Built around a risk calibration learned from your actual launch review history — what blocks at *your* company, not generically.

**Every output is a draft for attorney review — cited, flagged, and gated — not a legal conclusion.** The plugin does the work: reads the documents, applies your playbook, finds the issues, drafts the memo. A lawyer reviews, verifies, and decides. Citations are tagged by source so you know which ones came from a research tool and which ones need checking. Privilege markers are applied conservatively so nothing waives by accident. Consequential actions — filing, sending, executing — are gated behind explicit confirmation.

## Who this is for

| Role | Primary workflows |
|---|---|
| **Product counsel** | Launch review, feature risk assessment, calibration maintenance |
| **Product managers** | "Is this a problem?" triage self-serve |
| **Marketing** | Claims review before ship |
| **GC / Legal leadership** | Feature risk assessments for escalated items |

## First run: the cold-start interview

Connects to your launch tracker (Jira/Linear), reads ten of your past launch reviews, learns what you actually block vs. what you wave through. Builds a risk calibration table that every other skill reads from.

Your configuration is stored at `~/.config/oscar/profile.json` and survives plugin updates.

```
Oscar GC onboarding
```

## Commands

| Command | Does |
|---|---|
| Oscar GC onboarding | Cold-start interview |
| `launch-review [PRD or ticket]` | Full launch review against your framework |
| `marketing-claims-review [copy]` | Marketing claims review |
| `is-this-a-problem [question]` | Fast "is this a problem?" answer |
| `matter-workspace` | Manage matter workspaces (multi-client private practice only) — new, list, switch, close, none |

## Skills

| Skill | Purpose |
|---|---|
| **Oscar GC onboarding** | Writes ~/.config/oscar/profile.json from interview + past launch reviews |
| **launch-review** | Category-by-category review, calibrated to your company |
| **marketing-claims-review** | Claims taxonomy: puffery/factual/comparative/implied/absolute |
| **feature-risk-assessment** | Deep dive on one issue when launch review isn't enough |
| **is-this-a-problem** | Same-minute triage for the quick Slack question |
| **matter-workspace** | Create, list, switch, and close matter workspaces for multi-client practices; isolates each client/matter so context does not leak across them |

## Interactive commands vs. scheduled agents

The commands above run when you invoke them — for when you're working a matter. The agents below run on a schedule — for what moves while you're not looking:

| Agent | What it watches | Default cadence |
|---|---|---|
| **launch-watcher** | Launch tracker (Jira/Linear) for upcoming launches that likely need legal review; filters tickets with launch dates in the next 30 days per the calibration table | Daily |

## Integrations

**Connect a research tool first — the citation guardrails depend on it.** Without one, every cite is tagged `[verify]` and the reviewer note above each deliverable records that sources weren't verified. Skills work either way; a research tool (CourtListener) just shifts verification work off your plate.

Ships with connectors configured in `.mcp.json`:

- **Slack** — search messages, read channels, find discussions (general bucket)
- **Google Drive** — search, read, and fetch documents (general bucket)
- **Linear** — issue tracking and project management
- **Atlassian** — Jira issues and Confluence pages
- **Asana** — tasks and project tracking

With a tracker connected: cold-start pulls launch history, launch-review pulls ticket context, launch-watcher agent monitors the calendar.

## Quick start

```
Oscar GC onboarding
```

Then:

```
is-this-a-problem "Can we A/B test the pricing page?"
```

→ Same-minute answer calibrated to your risk table.

```
launch-review PROJ-1234
```

→ Full review, category-by-category, with action items.

## How it learns

Your practice profile at `~/.config/oscar/profile.json` isn't static — it improves as you use the plugin. Skills tell you when an output used a default you should tune. You can re-run setup, edit the file directly, or tell a skill to record a new position.

## Notes

- The calibration table is the whole thing. If it's wrong, every review is wrong. Re-run setup when your risk posture changes (new regulator, new consent decree, new GC).
- `is-this-a-problem` is designed for PMs to self-serve. It answers fast and routes to a real review when it should.
- Feature risk assessment is for the 10% of launches that need depth. Most don't — don't generate paperwork.

## Prerequisites

Some features reference external integrations (document management, launch trackers, eDiscovery, case management, regulatory feeds). These are not bundled — if you have an MCP server for one of these in your environment, the relevant features will use it. Without one, the plugin falls back to file upload and manual workflows. Run `Oscar GC onboarding --check-integrations` to see what's available in your environment.

## Configuration

Your configuration is stored at `~/.config/oscar/profile.json` and survives plugin updates — you only run setup once.
