use crate::agents::extension::ExtensionConfig;
use crate::recipe::read_recipe_file_content::read_recipe_file;
use crate::recipe::Recipe;
use regex::{NoExpand, Regex};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use utoipa::ToSchema;

/// Represents a secret requirement discovered from a recipe extension.
///
/// Sprint 16 (ADR-058): Lifted from `goose-cli/src/recipes/secret_discovery.rs`
/// to `goose-core` so the desktop and `goose-server` can use the same scan
/// logic the CLI already had. The CLI continues to consume this via a
/// re-export at `goose-cli/src/recipes/secret_discovery.rs`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SecretRequirement {
    /// The environment variable name (e.g., "GITHUB_TOKEN")
    pub key: String,
    /// The name of the extension that requires this secret
    pub extension_name: String,
}

impl SecretRequirement {
    pub fn new(extension_name: String, key: String) -> Self {
        Self {
            key,
            extension_name,
        }
    }

    /// Returns a human-readable description of what this secret is for
    pub fn description(&self) -> String {
        format!("Required by {} extension", self.extension_name)
    }
}

/// Discovers all secrets required by MCP extensions in a recipe and its sub-recipes.
///
/// Recursively scans the recipe and any sub-recipes (by path) for extensions
/// and collects their declared `env_keys`, returning a deduplicated list.
pub fn discover_recipe_secrets(recipe: &Recipe) -> Vec<SecretRequirement> {
    let mut visited_recipes = HashSet::new();
    discover_recipe_secrets_recursive(recipe, &mut visited_recipes)
}

fn extract_secrets_from_extensions(
    extensions: &[ExtensionConfig],
    seen_keys: &mut HashSet<String>,
) -> Vec<SecretRequirement> {
    let mut secrets = Vec::new();

    for ext in extensions {
        let (extension_name, env_keys) = match ext {
            ExtensionConfig::Stdio { name, env_keys, .. } => (name, env_keys),
            ExtensionConfig::StreamableHttp { name, env_keys, .. } => (name, env_keys),
            ExtensionConfig::Builtin { name, .. } => (name, &Vec::new()),
            ExtensionConfig::Platform { name, .. } => (name, &Vec::new()),
            ExtensionConfig::Frontend { name, .. } => (name, &Vec::new()),
            ExtensionConfig::InlinePython { name, .. } => (name, &Vec::new()),
            // SSE is unsupported - skip
            ExtensionConfig::Sse { name, .. } => {
                tracing::warn!(name = %name, "SSE is unsupported, skipping");
                continue;
            }
        };

        for key in env_keys {
            if seen_keys.insert(key.clone()) {
                secrets.push(SecretRequirement::new(extension_name.clone(), key.clone()));
            }
        }
    }

    secrets
}

fn discover_recipe_secrets_recursive(
    recipe: &Recipe,
    visited_recipes: &mut HashSet<String>,
) -> Vec<SecretRequirement> {
    let mut secrets: Vec<SecretRequirement> = Vec::new();
    let mut seen_keys = HashSet::new();

    if let Some(extensions) = &recipe.extensions {
        secrets.extend(extract_secrets_from_extensions(extensions, &mut seen_keys));
    }

    if let Some(sub_recipes) = &recipe.sub_recipes {
        for sub_recipe in sub_recipes {
            if visited_recipes.contains(&sub_recipe.path) {
                continue;
            }
            visited_recipes.insert(sub_recipe.path.clone());

            match load_sub_recipe(&sub_recipe.path) {
                Ok((loaded_recipe, parent_dir)) => {
                    let sub_secrets =
                        discover_sub_recipe_secrets(&loaded_recipe, &parent_dir, visited_recipes);
                    for sub_secret in sub_secrets {
                        if seen_keys.insert(sub_secret.key.clone()) {
                            secrets.push(sub_secret);
                        }
                    }
                }
                Err(_) => {
                    continue;
                }
            }
        }
    }

    secrets
}

fn discover_sub_recipe_secrets(
    recipe: &Recipe,
    parent_dir: &str,
    visited_recipes: &mut HashSet<String>,
) -> Vec<SecretRequirement> {
    let re = Regex::new(r"\{\{\s*recipe_dir\s*\}\}").expect("valid regex");
    let mut resolved = recipe.clone();
    if let Some(ref mut sub_recipes) = resolved.sub_recipes {
        for sr in sub_recipes.iter_mut() {
            sr.path = re.replace_all(&sr.path, NoExpand(parent_dir)).into_owned();
        }
    }
    discover_recipe_secrets_recursive(&resolved, visited_recipes)
}

fn load_sub_recipe(recipe_path: &str) -> Result<(Recipe, String), Box<dyn std::error::Error>> {
    let recipe_file = read_recipe_file(recipe_path)?;
    let recipe: Recipe = serde_yaml::from_str(&recipe_file.content)?;
    let parent_dir = recipe_file.parent_dir.display().to_string();
    Ok((recipe, parent_dir))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::extension::{Envs, ExtensionConfig};
    use crate::recipe::Recipe;
    use std::collections::HashMap;

    fn create_test_recipe_with_extensions() -> Recipe {
        Recipe {
            version: "1.0.0".to_string(),
            title: "Test Recipe".to_string(),
            description: "A test recipe with MCP extensions".to_string(),
            instructions: Some("Test instructions".to_string()),
            prompt: None,
            extensions: Some(vec![
                ExtensionConfig::StreamableHttp {
                    name: "github-mcp".to_string(),
                    uri: "http://localhost:8080/mcp".to_string(),
                    envs: Envs::new(HashMap::new()),
                    env_keys: vec!["GITHUB_TOKEN".to_string(), "GITHUB_API_URL".to_string()],
                    description: "github-mcp".to_string(),
                    timeout: None,
                    socket: None,
                    bundled: None,
                    available_tools: Vec::new(),
                    headers: HashMap::new(),
                },
                ExtensionConfig::Stdio {
                    name: "slack-mcp".to_string(),
                    cmd: "slack-mcp".to_string(),
                    args: vec![],
                    envs: Envs::new(HashMap::new()),
                    env_keys: vec!["SLACK_TOKEN".to_string()],
                    timeout: None,
                    description: "slack-mcp".to_string(),
                    bundled: None,
                    available_tools: Vec::new(),
                },
                ExtensionConfig::Builtin {
                    name: "builtin-ext".to_string(),
                    display_name: None,
                    description: "builtin-ext".to_string(),
                    timeout: None,
                    bundled: None,
                    available_tools: Vec::new(),
                },
            ]),
            settings: None,
            activities: None,
            author: None,
            parameters: None,
            response: None,
            sub_recipes: None,
            retry: None,
        }
    }

    #[test]
    fn test_discover_recipe_secrets() {
        let recipe = create_test_recipe_with_extensions();
        let secrets = discover_recipe_secrets(&recipe);

        assert_eq!(secrets.len(), 3);

        let github_token = secrets.iter().find(|s| s.key == "GITHUB_TOKEN").unwrap();
        assert_eq!(github_token.key, "GITHUB_TOKEN");
        assert_eq!(github_token.extension_name, "github-mcp");
        assert_eq!(
            github_token.description(),
            "Required by github-mcp extension"
        );

        let slack_token = secrets.iter().find(|s| s.key == "SLACK_TOKEN").unwrap();
        assert_eq!(slack_token.key, "SLACK_TOKEN");
        assert_eq!(slack_token.extension_name, "slack-mcp");
    }

    #[test]
    fn test_discover_recipe_secrets_empty_recipe() {
        let recipe = Recipe {
            version: "1.0.0".to_string(),
            title: "Empty Recipe".to_string(),
            description: "A recipe with no extensions".to_string(),
            instructions: Some("Test instructions".to_string()),
            prompt: None,
            extensions: None,
            settings: None,
            activities: None,
            author: None,
            parameters: None,
            response: None,
            sub_recipes: None,
            retry: None,
        };

        let secrets = discover_recipe_secrets(&recipe);
        assert_eq!(secrets.len(), 0);
    }

    #[test]
    fn test_discover_recipe_secrets_deduplication() {
        let recipe = Recipe {
            version: "1.0.0".to_string(),
            title: "Test Recipe".to_string(),
            description: "A test recipe with duplicate secrets".to_string(),
            instructions: Some("Test instructions".to_string()),
            prompt: None,
            extensions: Some(vec![
                ExtensionConfig::StreamableHttp {
                    name: "service-a".to_string(),
                    uri: "http://localhost:8080/mcp".to_string(),
                    envs: Envs::new(HashMap::new()),
                    env_keys: vec!["API_KEY".to_string()],
                    description: "service-a".to_string(),
                    timeout: None,
                    socket: None,
                    bundled: None,
                    available_tools: Vec::new(),
                    headers: HashMap::new(),
                },
                ExtensionConfig::Stdio {
                    name: "service-b".to_string(),
                    cmd: "service-b".to_string(),
                    args: vec![],
                    envs: Envs::new(HashMap::new()),
                    env_keys: vec!["API_KEY".to_string()],
                    timeout: None,
                    description: "service-b".to_string(),
                    bundled: None,
                    available_tools: Vec::new(),
                },
            ]),
            settings: None,
            activities: None,
            author: None,
            parameters: None,
            response: None,
            sub_recipes: None,
            retry: None,
        };

        let secrets = discover_recipe_secrets(&recipe);
        assert_eq!(secrets.len(), 1);
    }

    #[test]
    fn test_secret_requirement_creation() {
        let req = SecretRequirement::new("test-ext".to_string(), "API_TOKEN".to_string());

        assert_eq!(req.key, "API_TOKEN");
        assert_eq!(req.extension_name, "test-ext");
        assert_eq!(req.description(), "Required by test-ext extension");
    }
}
