use std::collections::HashSet;
use std::path::Path;

use goose_sdk::custom_requests::SourceEntry;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SlashCommandSource {
    Builtin,
    Skill,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SlashCommandEntry {
    pub name: String,
    pub description: String,
    pub source: SlashCommandSource,
    pub input_hint: Option<String>,
}

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
    let reserved_names: HashSet<String> = commands
        .iter()
        .map(|command| normalize_command_name(&command.name))
        .collect();
    commands.extend(
        skill_commands(crate::skills::list_installed_skills(working_dir))
            .into_iter()
            .filter(|command| !reserved_names.contains(&normalize_command_name(&command.name))),
    );
    commands
}

fn skill_commands(sources: Vec<SourceEntry>) -> Vec<SlashCommandEntry> {
    sources
        .into_iter()
        .filter_map(|source| {
            let name = normalize_command_name(&source.name);
            if name.is_empty() {
                return None;
            }

            Some(SlashCommandEntry {
                name,
                description: source.description,
                source: SlashCommandSource::Skill,
                input_hint: None,
            })
        })
        .collect()
}

fn normalize_command_name(name: &str) -> String {
    name.trim_start_matches('/').to_lowercase()
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
    use goose_sdk::custom_requests::SourceType;
    use std::collections::HashMap;
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
            "---\nname: code-review\ndescription: Review changed code\n---\nReview the diff.",
        )
        .unwrap();

        let commands = list_acp_commands(Some(tmp.path()));
        let command = commands
            .iter()
            .find(|command| command.name == "code-review")
            .expect("project skill should be listed as an ACP command");

        assert_eq!(command.description, "Review changed code");
        assert_eq!(command.source, SlashCommandSource::Skill);
        assert_eq!(command.input_hint, None);
    }

    #[test]
    fn skill_commands_do_not_override_builtins() {
        let reserved_names = list_builtin_commands()
            .into_iter()
            .map(|command| normalize_command_name(&command.name))
            .collect();
        let commands: Vec<_> = skill_commands(vec![
            source_entry(SourceType::Skill, "compact", "Skill named compact"),
            source_entry(SourceType::Skill, "review", "Review code"),
        ])
        .into_iter()
        .filter(|command| !reserved_names.contains(&normalize_command_name(&command.name)))
        .collect();
        let names: Vec<_> = commands
            .iter()
            .map(|command| command.name.as_str())
            .collect();

        assert_eq!(names, vec!["review"]);
    }

    fn source_entry(source_type: SourceType, name: &str, description: &str) -> SourceEntry {
        SourceEntry {
            source_type,
            name: name.to_string(),
            description: description.to_string(),
            content: String::new(),
            path: String::new(),
            global: false,
            writable: false,
            supporting_files: Vec::new(),
            properties: HashMap::new(),
        }
    }
}
