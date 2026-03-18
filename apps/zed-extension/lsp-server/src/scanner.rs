use crate::patterns::{Pattern, PATTERNS};

pub struct Finding {
    pub line: usize,
    pub severity: String,
    pub description: String,
    pub suggestion: String,
}

fn line_number(content: &str, index: usize) -> usize {
    content[..index].chars().filter(|&c| c == '\n').count() + 1
}

fn matches_language(pattern: &Pattern, language: &str) -> bool {
    if pattern.languages.is_empty() {
        return true;
    }
    pattern.languages.contains(&language)
}

pub fn scan(content: &str, language: &str) -> Vec<Finding> {
    let mut findings = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    for pattern in PATTERNS.iter() {
        if !matches_language(pattern, language) {
            continue;
        }

        for mat in pattern.regex.find_iter(content) {
            let line = line_number(content, mat.start());

            // Check for hwa-ignore
            if line > 0 && line <= lines.len() {
                let current_line = lines[line - 1];
                let prev_line = if line > 1 { lines[line - 2] } else { "" };
                if current_line.contains("hwa-ignore") || prev_line.contains("hwa-ignore") {
                    continue;
                }
            }

            findings.push(Finding {
                line,
                severity: pattern.severity.to_string(),
                description: pattern.description.to_string(),
                suggestion: pattern.suggestion.to_string(),
            });
        }
    }

    findings
}
