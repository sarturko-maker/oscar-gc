# Goose2 Path Manipulation Implementation Plan

## Goal

Reduce filesystem path manipulation in the Tauri frontend by moving path ownership to the right
layer:

- ACP/goose owns Goose domain path facts.
- Tauri/Rust owns OS path mechanics.
- React/TypeScript owns display-only formatting and UI composition.

This plan follows the findings in `ui_improvements/goose2-path-manipulation-review.md`.

## Non-Goals

- Do not rewrite every path-looking string operation. Display-only formatting can remain in the
  frontend.
- Do not redesign all source types in the first implementation pass.
- Do not move project CRUD to ACP as part of the first cleanup. That is a larger architecture
  decision.
- Do not add broad generic path utilities that mix display formatting and native behavior.

## Phase 1: Stop Parsing Skill Project Scope

### Problem

`src/features/skills/api/skills.ts` parses `SourceEntry.directory` for markers like
`/.agents/skills/` to infer the project or workspace root.

### Decision

Use the existing ACP request context instead. The frontend already calls:

```ts
GooseSourcesList({ type: "skill", projectDir })
```

For non-global sources returned from that request, the project/workspace association is the requested
`projectDir`.

### Implementation

1. Change `toSkillInfo` in `src/features/skills/api/skills.ts` to accept a second argument:

   ```ts
   function toSkillInfo(
     source: SkillSourceEntry,
     projectDirContext: string | null,
   ): SkillInfo
   ```

2. Remove:

   - `PROJECT_SKILLS_MARKERS`
   - `normalizePath`
   - `deriveProjectRoot`
   - project-root parsing from `source.directory`

3. Keep or replace `basename` only as display-only fallback. Prefer moving it later to
   `pathDisplay.ts`.

4. In `listSkills(projectDirs)`, preserve request context:

   ```ts
   const globalResponse = await fetchSources();
   const projectResponse = await fetchSources(projectDir);

   globalResponse.sources.map((source) => toSkillInfo(source, null));
   projectResponse.sources.map((source) =>
     toSkillInfo(source, source.global ? null : projectDir),
   );
   ```

5. Preserve dedupe behavior. When the same global skill appears in global and project-scoped
   responses, keep one copy.

6. Keep `projectLinks` frontend-only.

## Phase 2: Introduce Display-Only Path Helpers

### Problem

Several UI modules implement their own basename or shortening helpers. Some are harmless, but the
duplication makes it easy to reuse display logic for behavior.

### Decision

Create a small frontend-only display helper module. This module is explicitly not authoritative for
filesystem behavior.

### Implementation

1. Add:

   ```text
   src/shared/lib/pathDisplay.ts
   ```

2. Add helpers only for labels:

   ```ts
   export function displayBasename(path: string): string
   export function shortenDisplayPath(path: string, options?: { homeDir?: string | null }): string
   export function displayRelativeToRoot(path: string, root: string): string
   ```

3. Add a top-of-file comment:

   ```ts
   // Display-only path formatting. Do not use these helpers for opening,
   // saving, resolving, comparing, scoping, or mutating filesystem paths.
   ```

4. Migrate display-only callers:

   - `src/features/chat/ui/FilesList.tsx`
   - `src/features/chat/hooks/useMentionHandlers.ts`
   - `src/features/chat/ui/widgets/WorkingContextPicker.tsx`
   - `src/features/chat/ui/widgets/ChangesWidget.tsx`
   - display fallback in `src/features/skills/api/skills.ts`, if still needed

5. Do not move artifact policy or behavioral comparisons into this module.

## Phase 3: Expand The Tauri Path Resolver API

### Problem

The existing path resolver only resolves parts and expands `~`. Several frontend issues need native
join, basename/dirname, comparable keys, and containment checks.

### Decision

Extend the existing path resolver command family, keeping all frontend invokes behind
`src/shared/api/pathResolver.ts`.

### Rust API Shape

In `src-tauri/src/commands/path_resolver.rs`, add request/response structs and commands for:

```rust
join_path(parts: Vec<String>) -> String
dirname_path(path: String) -> String
basename_path(path: String) -> String
normalize_path(path: String) -> String
path_comparable_key(path: String) -> String
is_path_inside_roots(path: String, roots: Vec<String>) -> bool
```

Notes:

- `path_comparable_key` should mirror the existing Rust behavior used in
  `src-tauri/src/commands/system.rs` where macOS and Windows are case-insensitive and Linux is not.
- `is_path_inside_roots` should use native path semantics. Prefer canonicalization where paths exist,
  with a documented fallback for non-existing paths.
- Keep errors specific and useful.

### Frontend API Shape

In `src/shared/api/pathResolver.ts`, expose:

```ts
export async function joinPath(parts: string[]): Promise<string>
export async function dirnamePath(path: string): Promise<string>
export async function basenamePath(path: string): Promise<string>
export async function normalizeNativePath(path: string): Promise<string>
export async function pathComparableKey(path: string): Promise<string>
export async function isPathInsideRoots(path: string, roots: string[]): Promise<boolean>
```

### Registration

Register new commands in `src-tauri/src/lib.rs`.

## Phase 4: Fix Changed-File Absolute Paths

### Problem

The chat context panel and changes widget join repo path and git-relative paths with `/`.

### Decision

Prefer returning `absolutePath` from Tauri git changes. This is cleaner than asking the frontend to
join paths.

### Implementation

1. Update changed-file type in Rust command, likely `src-tauri/src/commands/git_changes.rs`, to add:

   ```rust
   absolute_path: String
   ```

2. Compute `absolute_path` with `repo_path.join(file_path)`.

3. Update shared TS type for changed files.

4. Update:

   - `src/features/chat/ui/ContextPanel.tsx`
   - `src/features/chat/ui/widgets/ChangesWidget.tsx`

   to use `file.absolutePath` for open/reveal/context menu behavior.

5. Keep `file.path` as the git-relative display path.

## Phase 5: Fix Local File Asset Path Construction

### Problem

Local file-backed UI assets still do frontend path handling:

- `src/shared/lib/avatarUrl.ts` joins `avatarsDir` and avatar filename with `/`.
- `src/features/projects/ui/ProjectIcon.tsx` strips a `file:` prefix and passes the result directly
  to `convertFileSrc`.

### Decision

Prefer Tauri/Rust APIs that return a displayable asset URL or a resolved local asset path. If that
is too large, use native path resolver helpers before `convertFileSrc`.

### Option A: Better Boundary

Add Tauri commands that understand the relevant storage/domain shape:

```ts
resolve_persona_avatar_src(personaId or avatarValue) -> string
resolve_project_icon_src(iconValue) -> string
```

This keeps local asset storage and `file:` handling out of React components.

### Option B: Smaller Step

Use native path helpers before converting to an asset URL:

```ts
const path = await joinPath([dir, avatar.value]);
return convertFileSrc(path);
```

For project icons, move `file:` handling into a small shared helper or Tauri wrapper so component
code does not parse file-backed icon values directly.

### Recommendation

Use Option B first if the avatar and project icon storage formats are otherwise stable. Add a
TODO/design note only if either storage format is likely to change.

## Phase 6: Move Artifact Path Resolution To Tauri

### Problem

`artifactPathPolicyCore.ts` contains the largest and riskiest frontend path implementation.

### Decision

Keep text extraction and ranking in frontend. Move path resolution and scope decisions to Tauri.

### API Shape

Add a batch Tauri command, exposed via `src/shared/api/pathResolver.ts` or a dedicated
`src/shared/api/artifactPaths.ts`:

```ts
type ResolveArtifactCandidateRequest = {
  rawPath: string;
  allowOutsideRoots?: boolean;
};

type ResolveArtifactCandidatesRequest = {
  candidates: ResolveArtifactCandidateRequest[];
  allowedRoots: string[];
  baseRoot?: string | null;
};

type ResolvedArtifactCandidate = {
  rawPath: string;
  resolvedPath: string;
  comparableKey: string;
  allowed: boolean;
  blockedReason: string | null;
};
```

### Implementation Steps

1. Keep frontend candidate extraction:

   - arg keys
   - tool name path candidates
   - command arg extraction
   - markdown href extraction

2. Replace frontend resolution helpers with the native batch call:

   - `normalizePath`
   - `normalizeComparablePath`
   - `inferHomeDirFromRoots`
   - `resolveRelativeToBase`
   - `resolvePathCandidate`
   - `evaluatePathScope`

3. Preserve existing ranking behavior initially to avoid UX churn.

4. Preserve the existing policy boundary so the frontend still ranks candidates while Rust owns
   native resolution and containment.

## Phase 7: Move Artifact Open Fallback To Tauri

### Problem

`ArtifactPolicyContext.tsx` computes fallback open targets using slash-based logic.

### Decision

Add a native open-target resolver and use it before calling `openPath`.

### API Shape

```ts
resolveOpenTarget({ path, roots }): Promise<{ path: string } | null>
```

### Implementation

1. Move fallback rules from `ArtifactPolicyContext.tsx` to Rust.
2. Use native basename/parent logic.
3. Call `path_exists` or native metadata checks inside Rust.
4. Return final path or null.

## Phase 8: Move Worktree Preview To Tauri Git API

### Problem

`WorkspaceCreateDialog.tsx` reconstructs worktree preview paths in the UI.

### Decision

Use the same Rust logic for preview and creation.

### Implementation Options

Option A:

```ts
previewGitWorktreePath(path, name): Promise<string>
```

Option B:

Include a preview path in git state or creation dialog data.

### Recommendation

Option A is clearer and keeps the dialog simple.

## Phase 9: Move Project Artifact Roots / Effective Session Cwd Out Of UI

### Problem

The frontend currently owns project artifact root and session cwd policy.

### Decision

Short term, compute this in Tauri project Rust because projects currently live behind Tauri commands.
Long term, reconsider ACP if projects/session context become Goose domain APIs.

### Implementation

1. Extend `ProjectInfo` returned by Tauri with:

   ```ts
   artifactRoots: string[]
   defaultArtifactRoot: string | null
   defaultSessionCwd: string
   ```

2. Update `chatProjectContext.ts` to read returned fields instead of appending `artifacts`.

3. Update `sessionCwdSelection.ts` to use `defaultSessionCwd`.

4. Update `src/shared/api/acp.ts` so the default session working directory no longer falls back to a
   hardcoded `~/.goose/artifacts` literal in frontend code.

5. Keep existing `artifactsDir` during migration.

## Phase 10: Attachment Comparable Keys

### Problem

Attachment dedupe lowercases paths in frontend on non-Linux platforms.

### Decision

If dedupe should be authoritative, return a comparable key from Tauri path inspection.

### Implementation

1. Extend `AttachmentPathInfo`:

   ```ts
   comparableKey: string
   ```

2. Populate it in `inspect_attachment_paths` using native comparable-key logic.

3. Use it in `useChatInputAttachments.ts`.

### Note

This can be deferred if current dedupe is considered best-effort UI behavior.

## Phase 11: Source Location Design

### Problem

`SourceEntry.directory` is overloaded and source location semantics are unclear.

### Decision

Do not implement a one-off `contentPath` until a source model is agreed.

### Design Questions

- Does every source have a root/package path?
- Does every filesystem source have a primary file?
- Is update/delete/export keyed by path or by stable source ID?
- How should builtin sources represent location?
- How should skills represent supporting files?
- How should recipes and agents fit if they are file-based?
- Should `directory` be kept as a compatibility alias?

### Deliverable

Create a source model design note before code changes. After design approval, update:

- `crates/goose-sdk/src/custom_requests.rs`
- `crates/goose/src/sources.rs`
- `crates/goose/src/skills/mod.rs`
- generated SDK
- `src/features/skills/api/skills.ts`

## Phase 12: Guardrail Ideas

### Goal

Prevent new frontend path behavior from creeping back in.

### Ideas

1. Keep native path operations behind explicit API modules:

   - `src/shared/api/pathResolver.ts` for generic native path operations.
   - a dedicated feature API, such as `src/shared/api/artifactPaths.ts`, for higher-level artifact
     path policy if that API grows beyond generic resolver behavior.
   - `src/shared/lib/pathDisplay.ts` for display-only formatting.

2. Add a lightweight warning-only check after the first cleanup phases. It should flag risky path
   patterns outside approved modules.

   Patterns:

   - `/.agents/skills/`
   - `/.goose/skills/`
   - `/.claude/skills/`
   - appending `SKILL.md`
   - template-string joins that look like `` `${base}/${child}` ``
   - `replace(/\\/g, "/")`
   - `split("/")`
   - `lastIndexOf("/")`
   - `convertFileSrc` calls that build the input path with string concatenation

   Allowlist:

   - `src/shared/lib/pathDisplay.ts`
   - `src/shared/api/pathResolver.ts`
   - dedicated path API wrappers
   - tests
   - documentation
   - generated fixtures if any

3. Keep code review guidance simple: frontend code may format paths for display, but any path used
   for opening, saving, resolving, comparing, scoping, or mutation should come from ACP/goose or
   Tauri/Rust.

4. Start warning-only. Make the check blocking only after the false positives are understood and the
   known hotspots have been cleaned up.

## Suggested Execution Order

1. Phase 1: skill project scope request context.
2. Phase 2: display-only helper module.
3. Phase 3: expanded Tauri path resolver.
4. Phase 4: changed-file absolute paths.
5. Phase 5: local file asset path construction.
6. Phase 6 and 7: artifact resolver and open fallback.
7. Phase 8: worktree preview.
8. Phase 9: project artifact roots and default cwd.
9. Phase 10: attachment comparable keys, if needed.
10. Phase 11: source location design.
11. Phase 12: guardrail ideas.
