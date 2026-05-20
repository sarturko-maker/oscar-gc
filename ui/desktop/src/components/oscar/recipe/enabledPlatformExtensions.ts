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

const PLATFORM_LIKE_TYPES: ReadonlyArray<ExtensionConfig['type']> = [
  'platform',
  'builtin',
];

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
