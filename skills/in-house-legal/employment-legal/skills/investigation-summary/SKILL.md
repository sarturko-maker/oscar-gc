---
name: investigation-summary
description: >
  Draft an audience-specific summary from the privileged investigation memo —
  HR, leadership, or outside counsel versions. Use when an investigation memo
  needs to be communicated to an audience that should not see the full
  privileged work product.
argument-hint: "[matter name] [audience: hr / leadership / outside-counsel]"
---

<!-- Sourced from anthropics/claude-for-legal/employment-legal @ 4d55f539; Apache 2.0 -->

# /investigation-summary

Drafts a stripped-down, audience-appropriate summary from the privileged
investigation memo. HR summaries contain no privilege analysis. Leadership
summaries are high-level. Outside counsel briefings include full context.

## Instructions

1. Load the `internal-investigation` reference skill and run Mode 5 (Audience summary).
2. If no memo exists yet, offer to draft the memo first.
3. HR summaries must not include attorney mental impressions, credibility
   methodology, or legal exposure analysis.

## Examples

```
investigation-summary [matter name] hr
```

```
investigation-summary [matter name] leadership
```

```
investigation-summary [matter name] outside-counsel
```

> Detailed audience-stripping rules and summary templates live in the
> `internal-investigation` reference skill — load it before doing substantive
> work.
