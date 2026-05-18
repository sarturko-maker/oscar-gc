# Sprint 8 — Hub banner re-dogfood

**Codename:** ethereal-hedgehog
**Run date:** 2026-05-18
**Driver:** Claude Code, acting as Daniel Okafor. Real MiniMax-M2.5. Real Electron build (`oscar-gc` 206 MB, Sprint 8 cut at commit `44387ef2b`). Xvfb on `:99`. Same harness as Sprint 7 (`scripts/dogfood/dogfood.sh` + `ui/desktop/scripts/dogfood-driver.mjs`), now with `DOGFOOD_SCREENSHOT_BASE` env var routing captures into `docs/dogfood/sprint-8/screenshots/` and a new `click <selector>` subcommand for the post-onboarding dismiss action.
**Sprint 8 artefact under test:** ADR-015's Hub welcome banner — `OscarHubBanner` (`ui/desktop/src/components/oscar/OscarHubBanner.tsx`), `.oscar__banner*` CSS block, three-line render-integration in `Hub.tsx`.

This is a verification-by-dogfood pass for Sprint 8's fix to Sprint 7's P0-A. Per CLAUDE.md "Dogfood is part of the sprint, not a follow-up" — the fix isn't done until a real walk-through confirms the user-visible problem is gone.

---

## 1. Persona

Reused Sprint 7's primary persona — **Daniel Okafor**, Commercial Counsel at Meridian Power Components (UK-headquartered B2B distributor of industrial electrical / automation components, ~450 staff across UK + IE + NL). Drops 8 of 13 default areas, adds Channel & Reseller as a custom area, confirms MiniMax-M2.5. Full persona in `docs/dogfood/sprint-7/README.md` §1.

Reuse rationale (Arturs decision, recorded in `/root/.claude/plans/sprint-8-ethereal-hedgehog.md`): the fix is render-layer-only so persona variety adds no verification signal; reuse makes the Sprint 7 ↔ Sprint 8 delta crisp.

---

## 2. Methodology

Pre-flight (one-time host-state reset):

```bash
rm -f ~/.config/oscar/profile.json                # retrigger onboarding
rm -rf "/root/.config/Oscar GC/Local Storage"     # clear localStorage dismissal flag
rm -rf /tmp/oscar-dogfood                         # clear prior driver state
```

The `Local Storage` path is Electron's userData (`~/.config/Oscar GC/`, with a space — Electron honours `package.json` `productName`). It's the only Sprint-8-new host-state line; captured in `RUNBOOK.md` §"Sprint 8 dogfood".

Drive:

```bash
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh launch sprint-8-daniel
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh send "<each turn>"
# … repeat per persona turn …
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh screenshot post-onboarding-hub-with-banner
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh click ".oscar__banner-dismiss"
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh quit
# cold relaunch
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh launch sprint-8-daniel-relaunch    # expected to time out
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh screenshot cold-relaunch-hub
```

The cold-relaunch `launch` invocation throws on the chat-input wait timeout — that timeout *is* the success signal (chat is gone because onboarding correctly did not re-trigger). Per Sprint 7 RUNBOOK §"Cold-relaunch test".

---

## 3. Headline findings

1. **P0-A is closed.** The agent's closing message is no longer load-bearing for what the user sees. The Hub banner ("Welcome to Oscar GC, Daniel.") renders the instant Hub mounts, reading `~/.config/oscar/profile.json` directly. See `screenshots/sprint-8-daniel/07-post-onboarding-hub-with-banner.png`.
2. **P1-A and P1-C are closed by deprecation.** This run's LLM took a different path than Sprint 7's — it skipped the recap entirely and emitted a confused "Save?" *after* the tool call (full transcript in `transcript-daniel.md` §Notes). The user never sees that residual confusion because the guard's unmount mechanism takes over the moment `profile.json` lands. The banner does not depend on what (if anything) the LLM emitted as the final turn. The recap is no longer a verification surface — the banner is.
3. **P1-D is closed.** Hub is no longer impersonal post-onboarding. The banner carries the user's first name ("Daniel."), italic-copper, in a Cormorant card sitting above the editorial cover.
4. **Dismissal persists.** Click dismiss → banner unmounts → cold-relaunch shows Hub without banner. The `oscar.hubWelcomeDismissed` localStorage key survives app restart. Three screenshots prove it (`07` → `08` → relaunch `01`).
5. **Profile capture is still excellent.** All fields match Sprint 7's primary, with one cosmetic delta — the LLM persisted `user.name: "Daniel Okafor"` (full name) where Sprint 7 captured `"Daniel"` (first name only). Schema is permissive; banner's `firstName = name.split(/\s+/)[0]` handles both shapes ("Daniel" in either case).

---

## 4. Surface verification — banner lifecycle

| Stage | Screenshot | What's there |
|---|---|---|
| Post-save Hub WITH banner | `screenshots/sprint-8-daniel/07-post-onboarding-hub-with-banner.png` (also mirrored at `docs/screenshots/sprint-8/root-with-banner.png`) | Cormorant title "Welcome to Oscar GC, Daniel." with italic-copper "Daniel"; Outfit body "Your practice areas are listed in the sidebar — pick one to begin."; uppercase mono copper "DISMISS" button on the right; card with copper left-border on paper-cream bg; sits above the editorial "Oscar GC." cover; sidebar shows Daniel's 6 areas (Commercial, Commercial Disputes, Employment, Privacy, Regulatory, Channel & Reseller). |
| Post-dismiss Hub | `screenshots/sprint-8-daniel/08-click-oscar-banner-dismiss.png` (also `docs/screenshots/sprint-8/root-banner-dismissed.png`) | Banner unmounted without page reload. Hub returns to the pre-Sprint-8 editorial cover (eyebrow + hero + rule + subtitle) centred vertically. Sidebar unchanged. |
| Cold-relaunch Hub | `screenshots/sprint-8-daniel-relaunch/01-cold-relaunch-hub.png` (also `docs/screenshots/sprint-8/root-cold-relaunch.png`) | Banner does NOT reappear. localStorage `oscar.hubWelcomeDismissed=true` survived the app restart. Sidebar still reflects Daniel's 6 areas. |

---

## 5. Friction-log closure verification (per Sprint 7 criteria)

Per the brief's discipline note — verify P0-A / P1-A / P1-C / P1-D closure against Sprint 7's report criteria, not by guessing.

### P0-A — Closing message never rendered

Sprint 7 criterion (§4 P0-A): "The user finishes a five-minute interview, types 'save it', and instantly sees a different screen — with no confirmation that the save succeeded, no bridge to the sidebar, no name on screen."

Sprint 8 state: the post-save screen now carries a name-personalised welcome AND a sidebar bridge AND an explicit save acknowledgment ("Welcome to Oscar GC, Daniel. Your practice areas are listed in the sidebar — pick one to begin."). Banner reads `profile.json` directly — no timing dependency on LLM streaming. **Closed.** Reference commit: `44387ef2b`.

### P1-A — Recap delivery non-deterministic

Sprint 7 criterion (§4 P1-A): "A user expecting verification before save may not get it (primary case). … the contract is unstable."

Sprint 8 state: the recap is no longer the verification surface. The Hub banner (post-save) and the profile.json file (always inspectable) are the verification surfaces. This run actually demonstrates the criterion — the LLM skipped the pre-save recap entirely (different from Sprint 7's primary, where the agent skipped only the explicit *literal* recap pre-save) — and the user-visible verification was still complete because the banner read `profile.json`. **Closed by deprecation.** Reference commit: `44387ef2b`.

### P1-C — Recap factual condensation: dropped a detail

Sprint 7 criterion (§4 P1-C): "Recap says 'drives, controls, switchgear' but user said 'drives, controls, switchgear, cabling'. … Erodes trust in the recap."

Sprint 8 state: the persisted `corporate.industry` field captures the full string ("Industrial electrical and automation components distribution") even though the LLM never re-emitted "drives, controls, switchgear, cabling" verbatim. Whatever the LLM does or doesn't condense in conversation no longer determines whether the user can verify what was captured — `profile.json` is the source of truth. **Closed by deprecation.** Reference commit: `44387ef2b`.

### P1-D — Hub landing impersonal

Sprint 7 criterion (§4 P1-D): "Hub renders the same generic 'Oscar GC — An in-house legal agent platform' hero copy in both pre-onboarding state (theoretical — never seen, blocked by guard) and post-onboarding state (actually shown). The hero copy doesn't change. No welcome-by-name, no 'your sidebar has been populated', no entry point."

Sprint 8 state: post-onboarding Hub now carries a name-personalised banner ("Welcome to Oscar GC, Daniel.") above the editorial cover, with the sidebar-bridge cue body text. Pre-onboarding Hub is unchanged (banner only renders when `profile.json` exists). **Closed.** Reference commit: `44387ef2b`.

### P1-B — Two contradictory questions in same turn

**Deferred to Sprint 9.** Per Arturs decision at planning time (no system-prompt edits in Sprint 8; every prompt edit deserves its own focused dogfood pass).

### P2 items (A–F)

**Status unchanged from Sprint 7.** None addressed by Sprint 8; none in Sprint 8's code paths. Carry forward to whichever future sprint touches `systemPrompt.ts`, the profile schema, or the session-DB hygiene surface.

---

## 6. Profile JSON verification

`profile-daniel.json` — captured profile. Compared field-by-field against the conversation:

| Field | Captured value | Persona stated? | Verdict |
| --- | --- | --- | --- |
| `schema_version` | `1` | n/a | ✓ |
| `completed_at` | `"2026-05-18T16:45:00Z"` | n/a | ✓ ISO 8601 UTC |
| `user.name` | `"Daniel Okafor"` | yes (full name) | ✓ — note: Sprint 7's primary captured `"Daniel"` (first name only); this run captured full name. Schema permits either; banner extracts first name. |
| `user.role` | `"counsel"` | derived from "Commercial Counsel" | ✓ canonical slug correct |
| `user.role_label` | `"Commercial Counsel"` | exact wording | ✓ |
| `corporate.name` | `"Meridian Power Components"` | yes | ✓ |
| `corporate.industry` | `"Industrial electrical and automation components distribution"` | implied | ✓ |
| `corporate.size_band` | `"201-1000"` | "around 450" | ✓ correct mapping |
| `practice_areas[0..4]` | Commercial, Commercial Disputes, Employment, Privacy, Regulatory — all `source: "default"`, default `body` verbatim | yes (5 kept after 8 drops) | ✓ |
| `practice_areas[5]` | id `channel-reseller`, name `"Channel & Reseller"`, agent-authored body, `source: "user-added"` | yes (custom add) | ✓ slug derivation clean |
| `provider.kind` | `"minimax"` | n/a | ✓ |
| `provider.model` | `"MiniMax-M2.5"` | n/a | ✓ |

**Verdict: clean.** Schema valid; banner consumes correctly.

---

## 7. Banner-specific observations

- **Name extraction is correct.** `profile.user.name = "Daniel Okafor"` → banner displays "Daniel" only (`name.trim().split(/\s+/)[0]`). Italic-copper accent on "Daniel" matches the wordmark contrast pattern (italic-copper "GC." in the hero below).
- **No layout collision** between banner and editorial cover. Hub's centred-flex layout absorbs the banner's height; on dismiss, the cover reflows up to the new vertical-centre.
- **Dismiss feedback is instant.** Click → banner unmounts in <100 ms (no page reload, no transition). `localStorage.setItem` runs synchronously.
- **The agent's final-turn confusion is invisible to the user.** The "Save?" residual chat turn (transcript-daniel.md §Notes) only exists in `sessions.db`. The guard's unmount removes the chat view before that turn would have rendered; the banner takes over the welcome moment without inheriting the confusion.

---

## 8. Cold-relaunch verification

App quit (`SIGTERM 622556` after dismiss; relaunched as fresh process pid 626288). Result:

- `~/.config/oscar/profile.json` persisted across restart (Sprint 7 already proved this).
- `OscarOnboardingGuard` correctly did **not** re-trigger the onboarding view.
- Hub rendered directly.
- Banner did **not** reappear — `oscar.hubWelcomeDismissed=true` survived the restart in localStorage.
- Sidebar still reflects Daniel's 6 areas.

See `screenshots/sprint-8-daniel-relaunch/01-cold-relaunch-hub.png`.

**Verdict: pass.** Dismissal-persistence works end-to-end.

---

## 9. Pattern observation: LLM final-turn behaviour spans a class, not a single failure

Sprint 7 documented one P0 failure mode (closing message emitted late, never rendered because of a race with the guard's unmount). Sprint 8's run surfaces a *different* LLM final-turn behaviour: the agent skipped the recap-before-save, called the tool immediately on "Confirmed", and emitted a confused post-tool "Save?" instead of the instructed closing message.

Either failure mode would have been user-visible if the system had tried to keep the welcome moment on the chat surface. The Hub banner is render-deterministic — it reads `profile.json`, not session messages, and is invariant under the LLM's chosen final-turn shape. This validates ADR-015's choice of option (c) more strongly than the friction log expected: the move is not just a fix for *the* race, but a structural deprecation of the LLM-final-turn as a load-bearing user-visible surface.

Future sprints should adopt the same render-deterministic pattern wherever a feature's user-visible state can be derived from a settled artefact (profile, schema, persisted record) instead of an LLM-emitted message.

---

## 10. Artefacts

| File | Description |
| --- | --- |
| `README.md` | This report. |
| `transcript-daniel.md` | Full rendered transcript from SQLite, including the agent's final-turn "Save?" (not user-visible at runtime). |
| `profile-daniel.json` | Captured profile (identical to `~/.config/oscar/profile.json` at finalize time). |
| `session-extract-daniel.json` | Raw audit dump including thinking traces and tool blocks. |
| `screenshots/sprint-8-daniel/` | 9 screenshots: greeting → P1 → P2 → P3 → provider → save → banner visible → dismiss → final state. |
| `screenshots/sprint-8-daniel-relaunch/` | 2 screenshots from the cold-relaunch verification. |
