---
name: investigation-open
description: >
  Open a new internal investigation matter — runs intake, generates the sources
  checklist, and creates the persistent investigation log. Use when a complaint
  or allegation comes in and the attorney needs to stand up a privileged
  investigation workspace.
argument-hint: "[brief description of the allegation]"
---

<!-- Sourced from anthropics/claude-for-legal/employment-legal @ 4d55f539; Apache 2.0 -->

# /investigation-open

Opens a new investigation matter — runs intake, generates the sources
checklist, and creates the persistent investigation log.

## Instructions

1. Load `~/.config/oscar/profile.json`.
2. Load the `internal-investigation` reference skill and run Mode 1 (Open).
3. If a matter with the same slug already exists, warn before overwriting.

## Examples

```
investigation-open
Harassment complaint filed against a manager in the Austin office.
```

```
investigation-open
(skill will ask for details)
```

> Detailed intake, privilege-formation requirements, sources checklist, and log
> templates live in the `internal-investigation` reference skill — load it
> before doing substantive work.
