// Sprint 16 (ADR-058): The scan logic moved to `goose::recipe::secret_discovery`
// so the desktop / `goose-server` can use the same code path. This module
// is a thin re-export to preserve the existing CLI callsite at
// `goose-cli/src/recipes/recipe.rs:6`.
pub use goose::recipe::secret_discovery::{discover_recipe_secrets, SecretRequirement};
