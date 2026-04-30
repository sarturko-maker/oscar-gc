# Goose2 ACP Session ID Architecture Review

## Summary

Goose2 should use one canonical frontend session id:

```text
ChatSession.id == ACP sessionId == Goose Thread.id
```

The frontend should not model, persist, or translate a separate local session id. Internal Goose
`Session.id` is backend-private runtime state and should not cross the goose2 UI boundary.

The current implementation mostly behaves correctly because `ChatSession.id` is ultimately set from
ACP `sessionId`. However, the creation/preparation path still contains a temporary local id and a
local-to-ACP mapping layer. That creates unnecessary architectural risk: future callers can
accidentally use or persist the temporary id instead of the canonical ACP id.

## Domain Model

### ACP / Goose Backend

ACP protocol does not require a separate Thread domain. It only requires a `sessionId` that identifies
the client's session/conversation. Goose chose to implement ACP sessions using `Thread` because ACP
session and Goose internal `Session` have different intended lifecycles.

```text
ACP sessionId
  == Goose Thread.id
  == durable user-visible conversation identity

Goose internal Session.id
  == runtime execution context
  == provider/model runtime config, extension state, compaction/context state
```

The backend relationship is:

```text
Thread 1 : many internal Sessions
```

Thread exists so the user-visible conversation can stay stable while runtime state can be replaced or
edited. The original thread-introduction commit describes the intent:

```text
Threads are a new more durable abstraction for the user experience of
the conversation. They represent what the person saw. Sessions can
be edited by tools like compaction, or a thread can have multiple sessions
through a handoff. Threads are meant to be an append-only history of the
messages seen by the end user.
```

### Goose2 Frontend

Goose2 should treat the ACP id as the only session identity:

```text
UI ChatSession
  id: ACP sessionId / Goose Thread.id

Messages
  messagesBySession[ChatSession.id]

Drafts
  draftsBySession[ChatSession.id]

Active selection
  activeSessionId: ChatSession.id
```

Provider, model, project, and persona are session metadata/config. They are not identities.

```text
model
  ACP session config option: configId = "model"

provider
  Goose-specific session config option: configId = "provider"

project/persona
  Goose-specific metadata/config attached to the ACP session
```

## Current Implementation Review

### What Works Today

`ChatSessionStore.createSession()` stores the ACP id returned from `acpCreateSession()`:

```ts
const { sessionId } = await acpCreateSession(...);

const chatSession: ChatSession = {
  id: sessionId,
  acpSessionId: sessionId,
  ...
};
```

`loadSessions()` also maps backend ACP sessions directly:

```ts
id: session.sessionId,
acpSessionId: session.sessionId,
```

The session list itself is not persisted in localStorage. On app startup, goose2 hydrates sessions from
ACP `session/list`, so in-memory `ChatSession` objects are recreated from backend `Thread` ids.

Persisted frontend session references are limited:

```text
goose:home-session-id
  stores the Home draft session id

goose:chat-drafts
  stores draft text keyed by session id
```

Because `createSession()` currently stores the returned ACP id, these persisted keys use the correct
canonical id in normal flows.

### Architectural Risk

`acpCreateSession()` currently creates a temporary local id:

```ts
const localSessionId = crypto.randomUUID();
const gooseSessionId = await acpPrepareSession(localSessionId, ...);
return { sessionId: gooseSessionId };
```

That works only because `acpPrepareSession()` delegates to `acpSessionTracker.prepareSession()`, which
attempts:

```text
loadSession(localSessionId)
  fails because the local id is not a backend Thread id

newSession()
  returns real ACP sessionId / Thread.id
```

The temporary id is not persisted today, but the code implies that local ids and ACP ids are both valid
frontend concepts. That is the wrong boundary.

### Specific Issues

- `acpCreateSession()` relies on failure-driven control flow to create a new backend session.
- `prepareSession()` is overloaded: it both prepares existing sessions and creates new sessions when
  load fails.
- `acpSessionTracker` mixes runtime preparation caching with local-id-to-ACP-id translation.
- Frontend names such as `gooseSessionId` are misleading. The value is ACP `sessionId` / Goose
  `Thread.id`, not internal Goose `Session.id`.
- `ChatSession.acpSessionId` duplicates `ChatSession.id` and suggests the two can differ.
- Notification routing translates ACP ids back to local ids even though the target architecture has no
  local id.

## Target Architecture

### Canonical Invariant

```ts
type AcpSessionId = string;

interface ChatSession {
  id: AcpSessionId;
  title: string;
  providerId?: string;
  modelId?: string;
  personaId?: string;
  projectId?: string | null;
  ...
}
```

During the cleanup, while `acpSessionId` still exists:

```ts
session.id === session.acpSessionId
```

By the end of this cleanup, remove `ChatSession.acpSessionId`. It is only a temporary compatibility
field to keep intermediate PRs small.

### Layer Boundaries

```text
UI/store layer
  owns in-memory ChatSession objects
  keys UI state by ChatSession.id

shared/api ACP layer
  talks to ACP using AcpSessionId
  never generates local session ids
  never exposes internal Goose Session.id

Goose backend
  exposes Thread.id as ACP sessionId
  owns Thread -> internal Session relationship
```

### Creation vs Preparation

Creation should be the only code path that calls ACP `newSession()`.

```text
acpCreateSession()
  -> directAcp.newSession()
  -> returns ACP sessionId
  -> registers prepared cache under that same id
  -> optionally set model
```

Preparation should only prepare an existing ACP session.

```text
acpPrepareSession(existingSessionId)
  -> update working dir/provider if needed
  -> returns same existingSessionId
```

No prepare path should silently create a new session.

Important nuance: ACP `session/load` is not a harmless "prepare runtime" call in Goose. It also
replays the thread's visible message history through session notifications. Code that calls
`loadSession()` must either be an explicit replay/load path, or must intentionally suppress/handle the
replay notifications. Hidden `loadSession()` calls inside generic preparation are risky because replay
notifications can be routed through the live-stream handler if the UI has not marked that session as
loading.

Therefore, the target split should be:

```text
acpCreateSession()
  creates a new ACP session / Thread

acpLoadSession()
  explicitly loads an existing ACP session and replays history

acpPrepareLoadedSession()
  updates provider/workingDir cache for a session that is already loaded or newly created
```

Before prompting an existing session after app startup, the session must either have been created in
the current runtime or explicitly loaded through the replay/load path. Listing sessions from
`session/list` is not enough to instantiate the backend agent runtime.

### Prepared Session Cache

Replace the conceptual local-id mapper with a prepared-session cache:

```ts
type PreparedSession = {
  providerId: string;
  workingDir: string;
};

const preparedBySession = new Map<AcpSessionId, PreparedSession>();
```

If persona-specific preparation remains required:

```ts
function cacheKey(sessionId: AcpSessionId, personaId?: string): string {
  return personaId ? `${sessionId}:${personaId}` : sessionId;
}
```

The cache should not translate ids. It should only answer whether an ACP session has already been
prepared for a provider/persona/working directory combination.

## Clean Code Principles

### Use Accurate Names

Use:

```text
sessionId
acpSessionId
preparedSession
preparedBySession
getPreparedSessionId
```

Avoid:

```text
localSessionId
gooseSessionId
gooseToLocal
```

In frontend code, `gooseSessionId` is especially misleading because it sounds like internal Goose
`Session.id`, which goose2 should never see.

### Avoid Failure-Driven Session Creation

This pattern should be removed:

```text
try loadSession(randomLocalId)
catch createNewSession()
```

Explicit creation is clearer, easier to test, and matches the domain:

```text
create means create
prepare means prepare existing
```

### Avoid Duplicate Identity Fields

`ChatSession.acpSessionId` should be transitional only. Remove it as part of this cleanup once all
callers use canonical `id`.

Until removal, add guardrails:

```ts
function assertCanonicalSession(session: ChatSession): void {
  if (session.acpSessionId && session.acpSessionId !== session.id) {
    throw new Error("ChatSession.id must equal acpSessionId");
  }
}
```

Use this in `addSession`, `createSession`, and ACP list mapping during the migration.

### Keep Backend Complexity Behind the Boundary

Frontend should not know about:

```text
Thread.current_session_id
internal Goose Session.id
Thread -> Session cardinality
```

Frontend only needs:

```text
AcpSessionId
session metadata
session config options
session notifications keyed by AcpSessionId
```

## Detailed Implementation Plan

### Phase 1: Fix New Session Creation

Change `acpCreateSession()` to call ACP `newSession()` directly.

Target shape:

```ts
export async function acpCreateSession(
  providerId: string,
  workingDir: string,
  options: AcpCreateSessionOptions = {},
): Promise<{ sessionId: AcpSessionId }> {
  const response = await directAcp.newSession(
    workingDir,
    providerId,
    options.projectId,
    options.personaId,
  );
  const sessionId = response.sessionId;

  sessionTracker.registerSession(sessionId, sessionId, providerId, workingDir);

  if (options.modelId) {
    await directAcp.setModel(sessionId, options.modelId);
  }

  return { sessionId };
}
```

This keeps the existing tracker API temporarily, but removes the temporary local id.

Tests:

- `acpCreateSession` calls `directAcp.newSession`.
- `acpCreateSession` does not call `loadSession` with a generated local id.
- `acpCreateSession` registers the same id for UI and ACP.
- `chatSessionStore.createSession` stores `id === acpSessionId === returned sessionId`.

### Phase 2: Split Existing Session Preparation

Introduce stricter preparation/load functions with explicit names:

```ts
export async function loadExistingSessionForReplay(
  sessionId: AcpSessionId,
  workingDir: string,
): Promise<AcpSessionId>

export async function prepareLoadedSession(
  sessionId: AcpSessionId,
  providerId: string,
  workingDir: string,
  personaId?: string,
): Promise<AcpSessionId>
```

`loadExistingSessionForReplay()` behavior:

```text
1. Register the canonical id before loading, if the temporary compatibility mapper still exists.
2. Mark the UI session as loading before calling this function.
3. Call loadSession(sessionId, workingDir).
4. Let replay notifications fill the replay buffer.
5. Return sessionId.
```

`prepareLoadedSession()` behavior:

```text
1. Check prepared cache.
2. Update working dir/provider if changed.
3. Cache sessionId.
4. Return sessionId.
```

Important:

```text
load failure propagates
no newSession fallback
no hidden loadSession replay from generic preparation
```

Keep `prepareSession()` temporarily if needed, but narrow or rename it quickly. It should not both
create sessions and replay/load existing sessions.

Tests:

- Explicit replay loading returns the same id.
- Explicit replay loading propagates load errors.
- Loaded-session preparation never calls `newSession()`.
- Loaded-session preparation never calls `loadSession()` unexpectedly.

### Phase 3: Rename Frontend ACP Session Variables

Mechanical rename after behavior is safe:

```text
gooseSessionId -> acpSessionId
getGooseSessionId -> getAcpSessionId
getLocalSessionId -> remove or temporary getUiSessionId
gooseToLocal -> acpToUi, then remove
```

Prefer `sessionId` when the value is already canonical and no distinction is needed.

Tests should be unchanged except for names.

### Phase 4: Simplify Notification Routing

Current notification handling does:

```ts
const acpSessionId = notification.sessionId;
const localSessionId = getLocalSessionId(acpSessionId);
const sessionId = localSessionId ?? acpSessionId;
```

Target:

```ts
const sessionId = notification.sessionId;
```

This should happen only after local-id translation is removed from creation/preparation flows.

Tests:

- Live notifications update `messagesBySession[notification.sessionId]`.
- Replay notifications buffer under `notification.sessionId`.
- Usage updates apply directly to `notification.sessionId`.

### Phase 5: Remove `ChatSession.acpSessionId`

Update all callers to use `session.id` for backend calls:

```text
rename
archive
unarchive
project update
search/export/import/fork
load messages
```

Then remove:

```ts
acpSessionId?: string;
```

from `ChatSession`.

Tests:

- Session list/search/archive/rename/export all use `session.id`.
- No code path reads `session.acpSessionId`.

### Phase 6: Collapse Tracker to Prepared Cache

Once notification routing and `ChatSession.acpSessionId` are gone, delete local-id conversion.

Remove:

```text
gooseToLocal
getLocalSessionId
registerSession(localSessionId, acpSessionId, ...)
restoreGooseRegistration
```

Replace with:

```ts
registerPreparedSession(sessionId, entry)
unregisterPreparedSession(sessionId)
getPreparedSession(sessionId, personaId?)
```

## Verification Checklist

Run the smallest relevant frontend verification after each implementation phase:

```bash
pnpm test -- chatSessionStore
pnpm test -- acp
pnpm test -- acpNotificationHandler
pnpm test -- useChat
pnpm test -- useChatSessionController
```

Manual scenarios:

- Start a new Home chat.
- Start a new project chat.
- Send first message.
- Reload app and verify the same session appears.
- Switch provider/model in an existing chat.
- Move a chat to another project.
- Load/replay an existing session.
- Compact an existing session.
- Archive/rename a session.

## Final Target

The final frontend model should be simple:

```text
There is one session id in goose2.
It is ACP sessionId.
It is Goose Thread.id.
It is ChatSession.id.
```

The backend can keep Thread-to-internal-Session complexity, but the frontend should not encode that
complexity in its state shape or APIs.
