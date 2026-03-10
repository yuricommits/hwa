package extractor

import (
	"regexp"
	"strings"
)

type Package struct {
	Name      string
	Version   string
	Ecosystem string
	Line      int
}

var (
	importFrom    = regexp.MustCompile(`(?m)import\s+.*?from\s+['"]([^'"./][^'"]*)['"]`)
	requirePat    = regexp.MustCompile(`(?m)require\s*\(\s*['"]([^'"./][^'"]*)['"]`)
	pythonImport  = regexp.MustCompile(`(?m)^import\s+([a-zA-Z][a-zA-Z0-9_]*)`)
	pythonFrom    = regexp.MustCompile(`(?m)^from\s+([a-zA-Z][a-zA-Z0-9_]*)\s+import`)
	goImportBlock = regexp.MustCompile(`(?s)import\s*\((.*?)\)`)
	goImportLine  = regexp.MustCompile(`"([^"]+)"`)
)

func lineNumber(content string, index int) int {
	return strings.Count(content[:index], "\n") + 1
}

func getEcosystem(language string) string {
	switch language {
	case "python":
		return "pypi"
	case "go":
		return "go"
	default:
		return "npm"
	}
}

func extractNpm(content string) []Package {
	seen := map[string]bool{}
	var pkgs []Package

	for _, pat := range []*regexp.Regexp{importFrom, requirePat} {
		for _, match := range pat.FindAllStringSubmatchIndex(content, -1) {
			raw := content[match[2]:match[3]]
			name := raw
			if strings.HasPrefix(raw, "@") {
				parts := strings.SplitN(raw, "/", 3)
				if len(parts) >= 2 {
					name = parts[0] + "/" + parts[1]
				}
			} else {
				name = strings.SplitN(raw, "/", 2)[0]
			}
			if seen[name] {
				continue
			}
			seen[name] = true
			pkgs = append(pkgs, Package{
				Name:      name,
				Ecosystem: "npm",
				Line:      lineNumber(content, match[0]),
			})
		}
	}
	return pkgs
}

func extractPython(content string) []Package {
	seen := map[string]bool{}
	var pkgs []Package

	for _, pat := range []*regexp.Regexp{pythonImport, pythonFrom} {
		for _, match := range pat.FindAllStringSubmatchIndex(content, -1) {
			name := content[match[2]:match[3]]
			if seen[name] {
				continue
			}
			seen[name] = true
			pkgs = append(pkgs, Package{
				Name:      name,
				Ecosystem: "pypi",
				Line:      lineNumber(content, match[0]),
			})
		}
	}
	return pkgs
}

func extractGo(content string) []Package {
	seen := map[string]bool{}
	var pkgs []Package

	block := goImportBlock.FindStringSubmatchIndex(content)
	if block == nil {
		return pkgs
	}

	blockContent := content[block[2]:block[3]]
	lines := strings.Split(blockContent, "\n")
	for i, line := range lines {
		match := goImportLine.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		name := match[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		pkgs = append(pkgs, Package{
			Name:      name,
			Ecosystem: "go",
			Line:      i + 1,
		})
	}
	return pkgs
}

func ExtractPackages(content, language string) []Package {
	switch language {
	case "typescript", "javascript":
		return extractNpm(content)
	case "python":
		return extractPython(content)
	case "go":
		return extractGo(content)
	default:
		return extractNpm(content)
	}
}
