use std::collections::HashSet;
use std::path::Path;

use super::types::{SlashCommandEntry, SlashCommandSource};
use super::util::normalize_command_name;

pub fn list_builtin_commands() -> Vec<SlashCommandEntry> {
    crate::agents::execute_commands::list_commands()
        .iter()
        .map(|command| SlashCommandEntry {
            name: command.name.to_string(),
            description: command.description.to_string(),
            source: SlashCommandSource::Builtin,
            input_hint: builtin_input_hint(command.name).map(str::to_string),
        })
        .collect()
}

pub fn list_acp_commands(working_dir: Option<&Path>) -> Vec<SlashCommandEntry> {
    let mut commands = list_builtin_commands();
    let mut reserved_names: HashSet<String> = commands
        .iter()
        .map(|command| normalize_command_name(&command.name))
        .collect();

    for command in super::recipe_slash_command::commands_from_mappings(
        super::recipe_slash_command::list_commands(),
    ) {
        if reserved_names.insert(command.name.clone()) {
            commands.push(command);
        }
    }

    commands.extend(
        super::skill_slash_command::list_commands(working_dir)
            .into_iter()
            .filter(|command| !reserved_names.contains(&command.name)),
    );
    commands
}

fn builtin_input_hint(command: &str) -> Option<&'static str> {
    match command {
        "prompt" => Some("<name> [--info] [key=value...]"),
        "prompts" => Some("[--extension <name>]"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn lists_acp_safe_builtin_commands() {
        let commands = list_builtin_commands();
        let names: Vec<_> = commands
            .iter()
            .map(|command| command.name.as_str())
            .collect();

        assert_eq!(
            names,
            vec!["prompts", "prompt", "compact", "clear", "skills", "doctor"]
        );
        assert!(commands
            .iter()
            .all(|command| command.source == SlashCommandSource::Builtin));
    }

    #[test]
    fn includes_input_hints_for_argument_taking_builtins() {
        let commands = list_builtin_commands();
        let prompt = commands
            .iter()
            .find(|command| command.name == "prompt")
            .expect("prompt command should be listed");
        let prompts = commands
            .iter()
            .find(|command| command.name == "prompts")
            .expect("prompts command should be listed");
        let compact = commands
            .iter()
            .find(|command| command.name == "compact")
            .expect("compact command should be listed");

        assert_eq!(
            prompt.input_hint.as_deref(),
            Some("<name> [--info] [key=value...]")
        );
        assert_eq!(prompts.input_hint.as_deref(), Some("[--extension <name>]"));
        assert_eq!(compact.input_hint, None);
    }

    #[test]
    fn lists_project_skills_as_acp_commands() {
        let tmp = TempDir::new().unwrap();
        let skill_dir = tmp
            .path()
            .join(".agents")
            .join("skills")
            .join("code-review");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: code-review\ndescription: Review changed code\nmetadata:\n  argument-hint: \"[task]\"\n  arguments:\n    - task\n---\nReview the diff.",
        )
        .unwrap();

        let commands = list_acp_commands(Some(tmp.path()));
        let command = commands
            .iter()
            .find(|command| command.name == "code-review")
            .expect("project skill should be listed as an ACP command");

        assert_eq!(command.description, "Review changed code");
        assert_eq!(command.source, SlashCommandSource::Skill);
        assert_eq!(command.input_hint.as_deref(), Some("[task]"));
    }

    #[test]
    fn recipe_commands_reserve_names_before_skills() {
        let tmp = TempDir::new().unwrap();
        let recipe_path = tmp.path().join("review.yaml");
        std::fs::write(
            &recipe_path,
            "version: 1.0.0\ntitle: Review Recipe\ndescription: Review with a recipe\ninstructions: Review the change\n",
        )
        .unwrap();
        let mut commands = list_builtin_commands();
        let mut reserved_names: HashSet<String> = commands
            .iter()
            .map(|command| normalize_command_name(&command.name))
            .collect();
        for command in super::recipe_slash_command::commands_from_mappings(vec![
            super::recipe_slash_command::SlashCommandMapping {
                command: "review".to_string(),
                recipe_path: recipe_path.to_string_lossy().to_string(),
            },
        ]) {
            let name = normalize_command_name(&command.name);
            if reserved_names.insert(name) {
                commands.push(command);
            }
        }
        let skill_command = SlashCommandEntry {
            name: "review".to_string(),
            description: "Review code".to_string(),
            source: SlashCommandSource::Skill,
            input_hint: None,
        };
        if !reserved_names.contains(&normalize_command_name(&skill_command.name)) {
            commands.push(skill_command);
        }

        let review_commands: Vec<_> = commands
            .iter()
            .filter(|command| command.name == "review")
            .collect();

        assert_eq!(review_commands.len(), 1);
        assert_eq!(review_commands[0].source, SlashCommandSource::Recipe);
    }
}
