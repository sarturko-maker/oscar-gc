# Goose2 Path Manipulation Review

## Summary

The current `ui/goose2` frontend does too much filesystem path manipulation. Some of it is
display-only and acceptable, but several places construct, normalize, compare, resolve, or infer
meaning from paths in TypeScript. That is risky for cross-platform behavior, especially on Windows,
and it also blurs ownership between frontend UI, Tauri desktop APIs, and ACP/goose domain APIs.

The target architecture should be:

- ACP/goose returns Goose domain path facts.
- Tauri/Rust handles OS path mechanics.
- React/TypeScript only passes paths through and formats labels for display.

The existing Tauri path resolver is a good starting point, but it is currently too narrow for the
cleanup needed across the frontend. It only resolves path parts and expands `~`. We should keep that
pattern and add more native path operations where the frontend currently performs OS-sensitive work.

## Ownership Rules

### ACP / Goose

Move path data to ACP/goose when the value is a domain fact, such as:

- source location
- source primary file
- source supporting files
- selected project or workspace source context
- session working directory
- default session cwd
- artifact roots, if they are Goose runtime/domain policy

Do not use the Tauri path resolver to compensate for missing domain data if Goose already knows the
answer.

### Tauri / Rust

Use Tauri/Rust for OS path mechanics, such as:

- join
- normalize
- basename and dirname when used for behavior
- relative path resolution
- home expansion
- containment checks
- comparable path keys
- path existence
- open/reveal targets
- git path construction
- artifact path fallback resolution

### Frontend

Frontend path helpers are acceptable only when they are display-only, such as:

- visual basename labels
- path shortening
- search text
- non-authoritative relative display labels

Frontend display helpers must not be used before opening, saving, resolving, checking existence,
scoping, comparing for behavior, or mutating backend state.

## Review Results

### 1. Skills project scope is parsed from `directory`

Location:

- `src/features/skills/api/skills.ts`

Current behavior:

- The frontend hardcodes source layout markers:
  - `/.agents/skills/`
  - `/.goose/skills/`
  - `/.claude/skills/`
- It parses `SourceEntry.directory` to recover the project or workspace root.

Problem:

The frontend is reverse-engineering Goose source discovery layout. This couples React code to
backend filesystem conventions and creates avoidable platform/path risk.

Suggested fix:

Use the existing ACP request context. The frontend already calls:

```ts
GooseSourcesList({ type: "skill", projectDir })
```

When adapting that response, pass `projectDir` into `toSkillInfo`. For `source.global === false`,
associate the skill with that request's `projectDir`. This removes the path parsing without requiring
an ACP schema change.

Notes:

- `projectLinks` should remain a frontend UI aggregation model.
- ACP does not need to return project links.
- A later source model redesign may add explicit source scope, but it is not required for this
  cleanup.

### 2. Skill file path is built in frontend

Location:

- `src/features/skills/api/skills.ts`

Current behavior:

- ACP returns `directory`, which is the skill root folder.
- Frontend appends `SKILL.md` to produce `fileLocation`.

Problem:

The frontend knows a source implementation detail: skills are backed by a primary file named
`SKILL.md`. This is domain knowledge and should not be embedded in React adapters.

Suggested fix:

This needs a source model design before implementation. Do not blindly add `contentPath` as a
one-off field until the model is clear.

Design questions:

- Is `directory` the source root, the primary content file, or a mutation handle?
- Should source location expose both source root/package path and primary content file path?
- How should skill supporting files be represented?
- How should builtin sources represent location?
- How do recipe and agent sources fit if they are file-based rather than package-based?

Possible direction:

- Keep `directory` temporarily for compatibility.
- Introduce clearer location data after design, for example root/package path and primary file path.

### 3. Skill rename preview rewrites paths

Location:

- `src/features/skills/ui/CreateSkillDialog.tsx`

Current behavior:

- The edit dialog predicts the renamed `SKILL.md` path by splitting and rewriting `fileLocation`.

Problem:

The UI is predicting backend filesystem behavior using string manipulation.

Suggested fix:

Either remove the preview or ask backend/native code for the preview path. If the source model later
exposes a primary file path, rename preview still needs backend/native support because rename rules
belong with source update behavior.

### 4. Project artifact roots are derived in frontend

Location:

- `src/features/projects/lib/chatProjectContext.ts`

Current behavior:

- Frontend computes `workingDir/artifacts`.

Problem:

Artifact root policy is product/domain behavior, not UI string joining.

Suggested fix:

Short term, compute artifact roots in the existing Tauri project Rust API. Longer term, if projects
or session context move to ACP, return `artifactRoots` or `defaultArtifactRoot` from that domain API.

### 5. Session cwd is composed in frontend

Location:

- `src/features/projects/lib/sessionCwdSelection.ts`

Current behavior:

- Frontend decides effective cwd from:
  - active workspace path
  - first project working dir plus `artifacts`
  - project `artifactsDir`
  - fallback `~/.goose/artifacts`

Problem:

The UI owns runtime cwd policy. The existing path resolver helps native joining, but the policy still
lives in TypeScript.

Suggested fix:

Prefer a backend/domain API that returns effective session cwd for the selected project/workspace
context. If this remains desktop-only project behavior for now, compute it in Tauri Rust.

### 6. Artifact candidate paths are resolved in TypeScript

Location:

- `src/features/chat/lib/artifactPathPolicyCore.ts`

Current behavior:

Frontend code:

- normalizes separators
- detects absolute paths
- resolves relative paths against allowed roots
- infers home from roots
- dedupes comparable paths
- checks whether paths are inside allowed roots

Problem:

These paths come from model/tool text, not trusted domain data. Resolution and containment are
OS-sensitive and security-adjacent. TypeScript should not own this behavior.

Suggested fix:

Keep candidate extraction and ranking in frontend, but move path resolution and validation to
Tauri/Rust. Prefer a batch command so one message does not require many separate invokes.

Possible native API:

```ts
resolveArtifactCandidates({
  candidates,
  roots,
  baseRoot,
})
```

The response should include resolved paths, allowed/blocked status, and any comparable key needed by
the UI.

### 7. Artifact open fallback rewrites paths in frontend

Location:

- `src/features/chat/hooks/ArtifactPolicyContext.tsx`

Current behavior:

Frontend computes parent directories, basenames, and fallback artifact paths before opening.

Problem:

The UI decides which real path to open.

Suggested fix:

Add a Tauri command such as:

```ts
resolveOpenTarget({ path, roots })
```

The frontend should open only the returned path, or show not found if the result is null.

### 8. Changed file open path is joined with `/`

Location:

- `src/features/chat/ui/ContextPanel.tsx`

Current behavior:

Frontend joins repository path and git-relative file path using `/`.

Problem:

This can break native path rules on Windows.

Suggested fix:

Best option: have the Tauri `get_changed_files` command return both the git-relative path and the
absolute path.

Alternative: add a native `joinPath([repoPath, filePath])` helper and use that before opening.

### 9. Changes widget also joins paths with `/`

Location:

- `src/features/chat/ui/widgets/ChangesWidget.tsx`

Current behavior:

The widget builds `fullPath` with `repoPath/file.path`.

Problem:

Same as the changed-file open path issue.

Suggested fix:

Prefer a Tauri-returned `absolutePath` from the git changes API. If not available yet, use a native
join helper.

### 10. Worktree preview is reconstructed in UI

Location:

- `src/features/chat/ui/widgets/WorkspaceCreateDialog.tsx`

Current behavior:

Frontend splits the root path with `/` and reconstructs the preview worktree path.

Problem:

Tauri git Rust already owns the actual worktree path rules. The preview should use the same logic as
creation.

Suggested fix:

Expose a Tauri preview command or return a preview path from git state/API.

### 11. Project hydration path equality is ad hoc

Location:

- `src/features/skills/lib/projectHydration.ts`

Current behavior:

Frontend normalizes working dirs for equality using custom string rules.

Problem:

Behavioral path equality should not rely on ad hoc TypeScript normalization.

Suggested fix:

Most of this should disappear once skills use the ACP `projectDir` request context. If behavioral
equality is still required, add a native comparable-key helper.

### 12. Prompt working dir duplicate check normalizes paths in frontend

Location:

- `src/features/projects/lib/projectPromptText.ts`

Current behavior:

Frontend normalizes working dirs for duplicate detection in project prompt editing.

Problem:

This is lower risk because it is form validation, but platform behavior may still differ.

Suggested fix:

Acceptable for now if this remains best-effort UI validation. If duplicate detection needs to be
authoritative, use a native comparable-key helper.

### 13. Display basename and shortening helpers are duplicated

Locations include:

- `src/features/chat/ui/FilesList.tsx`
- `src/features/chat/hooks/useMentionHandlers.ts`
- `src/features/chat/ui/widgets/WorkingContextPicker.tsx`
- `src/features/chat/ui/widgets/ChangesWidget.tsx`

Current behavior:

Several modules implement their own basename, split, shorten, or display-relative logic.

Problem:

Some of these are display-only and acceptable, but duplication makes it easy to accidentally use a
display helper for behavior later.

Suggested fix:

Create a single display-only module, for example:

```text
src/shared/lib/pathDisplay.ts
```

Allowed helpers:

- `displayBasename`
- `shortenDisplayPath`
- `displayRelativeToRoot`

These helpers must be documented as display-only and must not be used for open/save/resolve/scope
behavior.

### 14. Local avatar URLs join directory and filename in frontend

Location:

- `src/shared/lib/avatarUrl.ts`

Current behavior:

The frontend fetches the avatars directory from Tauri and then builds the local avatar path with:

```ts
`${dir}/${avatar.value}`
```

Problem:

This constructs a native filesystem path in TypeScript. It is also a weak boundary: the frontend
knows that local avatar values are filenames relative to an avatars directory.

Suggested fix:

Prefer a Tauri command or API wrapper that returns a displayable asset URL for a local avatar value,
or at least use a native `joinPath` helper before `convertFileSrc`. The cleaner API is:

```ts
resolveAvatarAssetUrl(avatarValue)
```

That keeps avatar storage layout and path joining in Rust.

### 15. Attachment dedupe uses frontend path keys

Location:

- `src/features/chat/hooks/useChatInputAttachments.ts`

Current behavior:

The frontend dedupes selected attachments by lowercasing paths on non-Linux platforms.

Problem:

This is behavioral path equality in TypeScript. It is less risky than open-target resolution, but it
still encodes platform filesystem assumptions in the UI.

Suggested fix:

Prefer using a canonical/comparable path key returned from `inspectAttachmentPaths`, because that
command already lives in Tauri Rust and inspects paths. If that is too much for now, treat the current
logic as a temporary UI-only dedupe heuristic and avoid spreading it elsewhere.

### 16. Project file icon paths are converted in frontend

Location:

- `src/features/projects/ui/ProjectIcon.tsx`

Current behavior:

The frontend strips a `file:` prefix and calls `convertFileSrc(path)`.

Problem:

This is not as serious as path joining, but it means the UI understands the representation of local
project icon paths. If icon values are persisted domain data, the API boundary should be explicit
about whether the value is a native path, a file URI-ish string, or a display URL.

Suggested fix:

Clarify the project icon contract. Either:

- keep this as a UI display conversion and document `file:` icon values as frontend-facing data, or
- have the project/icon API return an asset URL or a structured icon value such as
  `{ kind: "file", path }`.

### 17. Default ACP cwd literals are hardcoded in frontend

Location:

- `src/shared/api/acp.ts`

Current behavior:

The frontend uses `~/.goose/artifacts` as a default cwd in ACP session paths.

Problem:

If ACP/goose treats `~` as part of its accepted cwd contract, this may be fine. If not, this is a
frontend-owned domain default and implicit path expansion rule.

Suggested fix:

Document the ACP cwd contract. If the default is a Goose runtime default, expose it from ACP/goose.
If the frontend must provide it, resolve it through the native path resolver before sending it.

## Path Resolver Recommendation

Current resolver:

- `src/shared/api/pathResolver.ts`
- `src-tauri/src/commands/path_resolver.rs`

Current capability:

- trims empty path parts
- expands `~`, `~/...`, and `~\...`
- joins parts using Rust `PathBuf`

This is useful but too narrow. Expand the resolver pattern into a small native path API.

Suggested functions:

```ts
joinPath(parts)
dirnamePath(path)
basenamePath(path)
normalizeNativePath(path)
isPathInsideRoots(path, roots)
resolveRelativePath(base, path)
pathComparableKey(path)
resolveOpenTarget(path, roots)
resolveArtifactCandidates(candidates, roots, baseRoot)
```

Use these for OS path mechanics. Do not use them as a workaround for missing ACP/domain path data.

Clean code note:

Keep the frontend wrapper as one small facade, for example `src/shared/api/pathResolver.ts`. Avoid
scattering raw `invoke("...path...")` calls across features. Also avoid creating a vague generic
`pathUtil` that mixes display formatting with native path behavior; keep display helpers in
`shared/lib/pathDisplay.ts` and native operations in the Tauri-backed API module.

## ACP / Domain Design Notes

### Source project association

Immediate fix:

- Use `projectDir` request context from `GooseSourcesList({ type: "skill", projectDir })`.
- Do not parse `SourceEntry.directory`.

Further design:

- Source scope metadata may be useful later, but it is not necessary for the current cleanup.

### Source location model

Do not rush a one-off `contentPath` addition without deciding the source model.

The model should answer:

- What is the source root or package path?
- What is the primary authored content path?
- What is the mutation handle for update/delete/export?
- How are supporting files represented?
- How are builtin sources represented?
- How do file-based recipe and agent sources fit?

### Session and artifact context

If session cwd and artifact roots are Goose runtime/domain concepts, they should eventually come from
ACP/goose. If they remain goose2 desktop project concepts, compute them in Tauri Rust instead of
TypeScript.

## Implementation Order

1. Fix skills project association by using `projectDir` request context.
2. Fix local avatar path construction by resolving the avatar asset URL or using native `joinPath`.
3. Fix changed-file absolute path joins by returning `absolutePath` from Tauri git changes or using
   native `joinPath`.
4. Expand the Tauri path resolver API with native join, dirname, basename, containment, and
   comparable-key helpers.
5. Move artifact candidate resolution and open-target fallback to Tauri/Rust.
6. Move worktree preview path generation to Tauri git API.
7. Decide the source location model before adding primary file path fields.
8. Move project artifact roots and effective session cwd out of frontend policy code.
9. Return native comparable keys for attachment dedupe if dedupe needs to be authoritative.
10. Centralize display-only path helpers in `shared/lib/pathDisplay.ts`.
11. Add guardrails to catch new frontend path joins or backend layout parsing outside approved
    modules.

## Guardrail Ideas

A lightweight check could flag new risky patterns outside approved modules:

- `/.agents/skills/`
- `/.goose/skills/`
- `/.claude/skills/`
- appending `SKILL.md`
- template strings like `` `${base}/${child}` ``
- `replace(/\\/g, "/")` outside display helpers
- `split("/")` or `lastIndexOf("/")` outside display helpers
- direct `convertFileSrc(`${dir}/${name}`)` style joins

This should be a warning-style maintainability check at first. Some display-only paths are legitimate,
so the allowlist matters.
