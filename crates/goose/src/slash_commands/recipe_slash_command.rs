use std::path::PathBuf;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tracing::warn;

use super::types::{SlashCommandEntry, SlashCommandSource};
use super::util::normalize_command_name;
use crate::config::Config;
use crate::recipe::{RecipeParameter, RecipeParameterRequirement};

const SLASH_COMMANDS_CONFIG_KEY: &str = "slash_commands";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommandMapping {
    pub command: String,
    pub recipe_path: String,
}

pub fn list_commands() -> Vec<SlashCommandMapping> {
    Config::global()
        .get_param(SLASH_COMMANDS_CONFIG_KEY)
        .unwrap_or_else(|err| {
            warn!(
                "Failed to load {}: {}. Falling back to empty list.",
                SLASH_COMMANDS_CONFIG_KEY, err
            );
            Vec::new()
        })
}

fn save_slash_commands(commands: Vec<SlashCommandMapping>) -> Result<()> {
    Config::global()
        .set_param(SLASH_COMMANDS_CONFIG_KEY, &commands)
        .map_err(|e| anyhow::anyhow!("Failed to save slash commands: {}", e))
}

pub fn set_recipe_slash_command(recipe_path: PathBuf, command: Option<String>) -> Result<()> {
    let recipe_path_str = recipe_path.to_string_lossy().to_string();

    let mut commands = list_commands();
    commands.retain(|mapping| mapping.recipe_path != recipe_path_str);

    if let Some(cmd) = command {
        let normalized_cmd = cmd.trim_start_matches('/').to_lowercase();
        if !normalized_cmd.is_empty() {
            commands.push(SlashCommandMapping {
                command: normalized_cmd,
                recipe_path: recipe_path_str,
            });
        }
    }

    save_slash_commands(commands)
}

pub fn get_recipe_for_command(command: &str) -> Option<PathBuf> {
    let normalized = command.trim_start_matches('/').to_lowercase();
    let commands = list_commands();
    commands
        .into_iter()
        .find(|mapping| mapping.command == normalized)
        .map(|mapping| PathBuf::from(mapping.recipe_path))
}

pub(super) fn commands_from_mappings(
    mappings: Vec<SlashCommandMapping>,
) -> Vec<SlashCommandEntry> {
    mappings
        .into_iter()
        .filter_map(|mapping| {
            let name = normalize_command_name(&mapping.command);
            if name.is_empty() {
                return None;
            }

            let metadata = recipe_entry(&mapping.recipe_path)?;

            Some(SlashCommandEntry {
                name,
                description: metadata.description,
                source: SlashCommandSource::Recipe,
                input_hint: metadata.input_hint,
            })
        })
        .collect()
}

struct RecipeCommandMetadata {
    description: String,
    input_hint: Option<String>,
}

fn recipe_entry(recipe_path: &str) -> Option<RecipeCommandMetadata> {
    let recipe_path = PathBuf::from(recipe_path);
    if !recipe_path.exists() {
        return None;
    }

    let recipe_content = std::fs::read_to_string(&recipe_path).ok()?;
    let recipe_dir = recipe_path.parent()?;
    let recipe_dir_str = recipe_dir.display().to_string();
    let validation_result = crate::recipe::validate_recipe::validate_recipe_template_from_content(
        &recipe_content,
        Some(recipe_dir_str),
    )
    .ok()?;

    Some(RecipeCommandMetadata {
        description: validation_result.description,
        input_hint: input_hint_for_recipe(validation_result.parameters.as_ref()),
    })
}

fn input_hint_for_recipe(params: Option<&Vec<RecipeParameter>>) -> Option<String> {
    let params = params?;
    if params.is_empty() {
        return None;
    }

    let mut required = Vec::new();
    let mut optional = Vec::new();

    for p in params {
        match p.requirement {
            RecipeParameterRequirement::Required | RecipeParameterRequirement::UserPrompt => {
                required.push(format!("<{}>", p.key));
            }
            RecipeParameterRequirement::Optional => {
                optional.push(format!("[--{} <{}>]", p.key, p.key));
            }
        }
    }

    Some(
        required
            .into_iter()
            .chain(optional)
            .collect::<Vec<_>>()
            .join(" "),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn commands_from_mappings_use_recipe_description() {
        let tmp = TempDir::new().unwrap();
        let recipe_path = tmp.path().join("review.yaml");
        std::fs::write(
            &recipe_path,
            "version: 1.0.0\ntitle: Review Recipe\ndescription: Review with a recipe\ninstructions: Review the change\n",
        )
        .unwrap();

        let commands = commands_from_mappings(vec![SlashCommandMapping {
            command: "/review".to_string(),
            recipe_path: recipe_path.to_string_lossy().to_string(),
        }]);

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].name, "review");
        assert_eq!(commands[0].description, "Review with a recipe");
        assert_eq!(commands[0].source, SlashCommandSource::Recipe);
    }

    #[test]
    fn commands_from_mappings_omit_hint_for_no_param_recipe() {
        let tmp = TempDir::new().unwrap();
        let recipe_path = tmp.path().join("status.yaml");
        std::fs::write(
            &recipe_path,
            "version: 1.0.0\ntitle: Status\ndescription: Check status\ninstructions: Check status\n",
        )
        .unwrap();

        let commands = commands_from_mappings(vec![SlashCommandMapping {
            command: "status".to_string(),
            recipe_path: recipe_path.to_string_lossy().to_string(),
        }]);

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].input_hint, None);
    }

    #[test]
    fn commands_from_mappings_render_one_required_param_hint() {
        let tmp = TempDir::new().unwrap();
        let recipe_path = tmp.path().join("review.yaml");
        std::fs::write(
            &recipe_path,
            "version: 1.0.0\ntitle: Review\ndescription: Review target\ninstructions: \"Review {{ target }}\"\nparameters:\n  - key: target\n    input_type: string\n    requirement: required\n    description: Target\n",
        )
        .unwrap();

        let commands = commands_from_mappings(vec![SlashCommandMapping {
            command: "review".to_string(),
            recipe_path: recipe_path.to_string_lossy().to_string(),
        }]);

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].input_hint.as_deref(), Some("<target>"));
    }

    #[test]
    fn commands_from_mappings_do_not_special_case_args_hint() {
        let tmp = TempDir::new().unwrap();
        let recipe_path = tmp.path().join("deploy.yaml");
        std::fs::write(
            &recipe_path,
            "version: 1.0.0\ntitle: Deploy\ndescription: Deploy\ninstructions: \"Deploy {{ component }} with {{ args }}\"\nparameters:\n  - key: component\n    input_type: string\n    requirement: required\n    description: Component\n  - key: args\n    input_type: string\n    requirement: optional\n    default: default args\n    description: Args\n",
        )
        .unwrap();

        let commands = commands_from_mappings(vec![SlashCommandMapping {
            command: "deploy".to_string(),
            recipe_path: recipe_path.to_string_lossy().to_string(),
        }]);

        assert_eq!(commands.len(), 1);
        assert_eq!(
            commands[0].input_hint.as_deref(),
            Some("<component> [--args <args>]")
        );
    }

    #[test]
    fn commands_from_mappings_skip_missing_and_invalid_recipes() {
        let tmp = TempDir::new().unwrap();
        let invalid_recipe_path = tmp.path().join("invalid.yaml");
        std::fs::write(&invalid_recipe_path, "not: a recipe").unwrap();

        let commands = commands_from_mappings(vec![
            SlashCommandMapping {
                command: "missing".to_string(),
                recipe_path: tmp
                    .path()
                    .join("missing.yaml")
                    .to_string_lossy()
                    .to_string(),
            },
            SlashCommandMapping {
                command: "invalid".to_string(),
                recipe_path: invalid_recipe_path.to_string_lossy().to_string(),
            },
        ]);

        assert!(commands.is_empty());
    }

    #[test]
    fn commands_from_mappings_render_multi_param_hint() {
        let tmp = TempDir::new().unwrap();
        let recipe_path = tmp.path().join("deploy.yaml");
        std::fs::write(
            &recipe_path,
            "version: 1.0.0\ntitle: Deploy\ndescription: Deploy a service\ninstructions: \"Deploy {{ component }} from {{ from }} to {{ to }} scope {{ scope }}\"\nparameters:\n  - key: component\n    input_type: string\n    requirement: required\n    description: Component\n  - key: from\n    input_type: string\n    requirement: required\n    description: From\n  - key: to\n    input_type: string\n    requirement: optional\n    default: prod\n    description: To\n  - key: scope\n    input_type: string\n    requirement: optional\n    default: all\n    description: Scope\n",
        )
        .unwrap();

        let commands = commands_from_mappings(vec![SlashCommandMapping {
            command: "deploy".to_string(),
            recipe_path: recipe_path.to_string_lossy().to_string(),
        }]);

        assert_eq!(commands.len(), 1);
        assert_eq!(
            commands[0].input_hint.as_deref(),
            Some("<component> <from> [--to <to>] [--scope <scope>]")
        );
    }
}
