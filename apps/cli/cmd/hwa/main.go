package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/yuricommits/hwa/cli/internal/output"
	"github.com/yuricommits/hwa/cli/internal/scanner"
)

const version = "0.1.0"

func usage() {
	fmt.Println(`
  hwa — AI code vulnerability scanner

  Usage:
    hwa scan <file> [file...]   Scan one or more files
    hwa version                 Print version

  Flags:
    --json    Output findings as JSON
    --help    Show this help message

  Examples:
    hwa scan auth.ts
    hwa scan src/*.py
    hwa scan . --json
`)
}

func collectFiles(paths []string) ([]string, error) {
	var files []string
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil {
			return nil, fmt.Errorf("cannot access %s: %w", path, err)
		}

		if info.IsDir() {
			err := filepath.WalkDir(path, func(p string, d os.DirEntry, err error) error {
				if err != nil {
					return err
				}
				if d.IsDir() && (d.Name() == "node_modules" || d.Name() == ".git" || d.Name() == "dist") {
					return filepath.SkipDir
				}
				ext := filepath.Ext(p)
				switch ext {
				case ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs":
					files = append(files, p)
				}
				return nil
			})
			if err != nil {
				return nil, err
			}
		} else {
			files = append(files, path)
		}
	}
	return files, nil
}

func main() {
	args := os.Args[1:]

	if len(args) == 0 {
		usage()
		os.Exit(0)
	}

	// Handle flags
	jsonOutput := false
	var filteredArgs []string
	for _, arg := range args {
		switch arg {
		case "--json":
			jsonOutput = true
		case "--help", "-h":
			usage()
			os.Exit(0)
		default:
			filteredArgs = append(filteredArgs, arg)
		}
	}
	args = filteredArgs

	command := args[0]

	switch command {
	case "version":
		fmt.Printf("hwa v%s\n", version)

	case "scan":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "Error: hwa scan requires at least one file or directory")
			os.Exit(1)
		}

		paths := args[1:]
		files, err := collectFiles(paths)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		if len(files) == 0 {
			fmt.Fprintln(os.Stderr, "No supported files found (.ts .tsx .js .jsx .py .go)")
			os.Exit(1)
		}

		if !jsonOutput {
			fmt.Printf("\n  %shwa%s scanning %d file(s)...\n", "\033[1m\033[97m", "\033[0m", len(files))
		}

		findings, err := scanner.ScanFiles(files)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		output.PrintFindings(findings, jsonOutput)

		if !jsonOutput {
			output.PrintSummary(findings, len(files))
		}

		// Exit code 1 if any critical findings
		for _, f := range findings {
			if f.Severity == "critical" {
				os.Exit(1)
			}
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", command)
		usage()
		os.Exit(1)
	}
}
