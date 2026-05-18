---
name: expansion-kickoff
description: >
  Kick off international expansion planning for a new country — gathers intake,
  runs EOR vs. entity framing, drafts cross-functional questions, surfaces
  country-specific flags, and creates a persistent tracker. Use when someone
  says "we're hiring in [country]", "expansion to [country]", or "first hire
  in [country]".
argument-hint: "[country name]"
---

<!-- Sourced from anthropics/claude-for-legal/employment-legal @ 4d55f539; Apache 2.0 -->

# /expansion-kickoff

Starts an international expansion project for a new country — gathers intake,
runs EOR vs. entity framing, drafts cross-functional questions, surfaces
country-specific flags, and creates a persistent tracker.

## Instructions

1. Load `~/.config/oscar/profile.json` → jurisdictional footprint, escalation table.
2. Load the `international-expansion` reference skill and run the full workflow.
3. If a tracker file already exists for this country (`~/.config/oscar/state/employment-legal/expansion-[slug].yaml`),
   flag it: "An expansion tracker for [country] already exists. Use
   `expansion-update [country]` to update it, or confirm
   you want to start over."
4. Create `~/.config/oscar/state/employment-legal/expansion-[slug].yaml` on completion.

## Examples

```
expansion-kickoff Germany
```

```
expansion-kickoff
(skill will ask which country)
```

> Detailed EOR vs. entity framework, cross-functional questions, briefing
> templates, and tracker schema live in the `international-expansion`
> reference skill — load it before doing substantive work.
