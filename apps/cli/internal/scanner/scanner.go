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

func ScanFile(path string) ([]Finding, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	content := string(data)
	language := DetectLanguage(path)
	var findings []Finding

	for _, pattern := range Patterns {
		if !matchesLanguage(pattern, language) {
			continue
		}
		for _, loc := range pattern.Regex.FindAllStringIndex(content, -1) {
			findings = append(findings, Finding{
				File:        path,
				Line:        lineNumber(content, loc[0]),
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
