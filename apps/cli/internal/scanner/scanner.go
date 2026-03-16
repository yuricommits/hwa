package scanner

import (
	"os"
	"path/filepath"
	"strings"
)

type Finding struct {
	File        string
	Line        int
	Severity    string
	Description string
	Suggestion  string
}

func DetectLanguage(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".rs":
		return "rust"
	case ".ts", ".tsx":
		return "typescript"
	case ".js", ".jsx":
		return "javascript"
	case ".py":
		return "python"
	case ".go":
		return "go"
	default:
		return "unknown"
	}
}

func matchesLanguage(p Pattern, language string) bool {
	if len(p.Languages) == 0 {
		return true
	}
	for _, l := range p.Languages {
		if l == language {
			return true
		}
	}
	return false
}

func lineNumber(content string, index int) int {
	return strings.Count(content[:index], "\n") + 1
}

func isIgnoredLine(lines []string, lineNum int) bool {
	if lineNum <= 0 || lineNum > len(lines) {
		return false
	}
	// Check current line and previous line for hwa-ignore
	if strings.Contains(lines[lineNum-1], "hwa-ignore") {
		return true
	}
	if lineNum > 1 && strings.Contains(lines[lineNum-2], "hwa-ignore") {
		return true
	}
	return false
}

func ScanFile(path string) ([]Finding, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	content := string(data)
	language := DetectLanguage(path)
	lines := strings.Split(content, "\n")
	var findings []Finding

	for _, pattern := range Patterns {
		if !matchesLanguage(pattern, language) {
			continue
		}
		for _, loc := range pattern.Regex.FindAllStringIndex(content, -1) {
			line := lineNumber(content, loc[0])
			if isIgnoredLine(lines, line) {
				continue
			}
			findings = append(findings, Finding{
				File:        path,
				Line:        line,
				Severity:    pattern.Severity,
				Description: pattern.Description,
				Suggestion:  pattern.Suggestion,
			})
		}
	}

	return findings, nil
}

func ScanFiles(paths []string) ([]Finding, error) {
	var all []Finding
	for _, path := range paths {
		findings, err := ScanFile(path)
		if err != nil {
			return nil, err
		}
		all = append(all, findings...)
	}
	return all, nil
}
