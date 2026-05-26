// Sprint 18 (ADR-065): recipe builders consume config.yaml platform-extension
// state so user toggles in Extensions Settings take effect for matter / Forge
// sessions. resolve_extensions_for_new_session (crates/goose/src/config/
// extensions.rs:169) returns recipe extensions only — so the recipe must
// carry the user's enabled platforms explicitly.
//
// Both 'platform' and 'builtin' ExtensionConfig types are included:
// extension_manager.add_extension treats them as the same in-process class
// (looks up PLATFORM_EXTENSIONS first, falls back to get_builtin_extension).
// Memory/Auto Visualiser/Tutorial/Computer Controller ship as 'builtin' via
// bundled-extensions.json; Top of Mind/Apps/Todo/Summon/Chat Recall/Developer/
// Extension Manager ship as 'platform' via the Rust migration.

import type { ExtensionConfig } from '../../../api';
import type { FixedExtensionEntry } from '../../ConfigContext';
import { nameToKey } from '../../settings/extensions/utils';

const PLATFORM_LIKE_TYPES: ReadonlyArray<ExtensionConfig['type']> = [
  'platform',
  'builtin',
];

// Sprint 31 (ADR-102): two platforms are hard-excluded from matter recipes
// regardless of the user's config.yaml state.
//   - `developer` per ADR-041 (recipe loadout is a security decision —
//     matter sessions never carry shell + filesystem-write). Sprint 30
//     dogfood found stale `developer.enabled: true` in pre-Sprint-18
//     config.yaml leaking into matter sessions via this filter.
//   - `computercontroller` because matter recipes already register a
//     narrowed instance (pdf_tool + docx_tool only, per ADR-085 Layer 2);
//     a user-toggled full instance would duplicate or override that.
// Quick chats and Forge call the base derive function — both correctly
// pick up the user-toggled developer for power users (quick chats) and
// neither needs the unscoped computercontroller surface.
const MATTER_EXCLUDED_PLATFORM_NAMES: ReadonlySet<string> = new Set([
  'developer',
  'computercontroller',
]);

export function deriveEnabledPlatformExtensions(
  extensionsList: readonly FixedExtensionEntry[],
): ExtensionConfig[] {
  return extensionsList
    .filter(
      (e) =>
        e.enabled &&
        (PLATFORM_LIKE_TYPES as ReadonlyArray<string>).includes(e.type),
    )
    .map(({ enabled: _enabled, ...rest }) => rest as ExtensionConfig);
}

export function deriveEnabledPlatformExtensionsForMatter(
  extensionsList: readonly FixedExtensionEntry[],
): ExtensionConfig[] {
  return deriveEnabledPlatformExtensions(extensionsList).filter(
    (e) => !MATTER_EXCLUDED_PLATFORM_NAMES.has(nameToKey(e.name)),
  );
}
