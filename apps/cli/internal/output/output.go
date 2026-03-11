package output

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/yuricommits/hwa/cli/internal/scanner"
)

const (
	reset  = "\033[0m"
	bold   = "\033[1m"
	red    = "\033[31m"
	yellow = "\033[33m"
	cyan   = "\033[36m"
	gray   = "\033[90m"
	white  = "\033[97m"
)

func severityColor(severity string) string {
	switch severity {
	case "critical":
		return red
	case "high":
		return "\033[38;5;208m" // orange
	case "medium":
		return yellow
	default:
		return cyan
	}
}

func severityLabel(severity string) string {
	return strings.ToUpper(severity)
}

func PrintFindings(findings []scanner.Finding, jsonOutput bool) {
	if jsonOutput {
		printJSON(findings)
		return
	}
	printColored(findings)
}

func printJSON(findings []scanner.Finding) {
	type jsonFinding struct {
		File        string `json:"file"`
		Line        int    `json:"line"`
		Severity    string `json:"severity"`
		Description string `json:"description"`
		Suggestion  string `json:"suggestion"`
	}

	out := make([]jsonFinding, len(findings))
	for i, f := range findings {
		out[i] = jsonFinding{
			File:        f.File,
			Line:        f.Line,
			Severity:    f.Severity,
			Description: f.Description,
			Suggestion:  f.Suggestion,
		}
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.Encode(out)
}

func printColored(findings []scanner.Finding) {
	if len(findings) == 0 {
		fmt.Printf("\n  %s✓ No vulnerabilities found%s\n\n", "\033[32m", reset)
		return
	}

	currentFile := ""
	for _, f := range findings {
		if f.File != currentFile {
			currentFile = f.File
			fmt.Printf("\n  %s%s%s%s\n", bold, white, f.File, reset)
		}

		color := severityColor(f.Severity)
		label := severityLabel(f.Severity)

		fmt.Printf("  %s%-8s%s  %sL%-4d%s  %s\n",
			color, label, reset,
			gray, f.Line, reset,
			f.Description,
		)
		fmt.Printf("  %s         → %s%s\n\n",
			gray, f.Suggestion, reset,
		)
	}
}

func PrintSummary(findings []scanner.Finding, files int) {
	critical := 0
	high := 0
	medium := 0
	low := 0

	for _, f := range findings {
		switch f.Severity {
		case "critical":
			critical++
		case "high":
			high++
		case "medium":
			medium++
		default:
			low++
		}
	}

	fmt.Printf("  %s─────────────────────────────────%s\n", gray, reset)
	fmt.Printf("  %sScanned%s  %d file(s)\n", gray, reset, files)
	fmt.Printf("  %sTotal%s    %d finding(s)\n", gray, reset, len(findings))

	if critical > 0 {
		fmt.Printf("  %s%-8s%s %d\n", red, "Critical", reset, critical)
	}
	if high > 0 {
		fmt.Printf("  %s%-8s%s %d\n", "\033[38;5;208m", "High", reset, high)
	}
	if medium > 0 {
		fmt.Printf("  %s%-8s%s %d\n", yellow, "Medium", reset, medium)
	}
	if low > 0 {
		fmt.Printf("  %s%-8s%s %d\n", cyan, "Low", reset, low)
	}
	fmt.Println()
}
