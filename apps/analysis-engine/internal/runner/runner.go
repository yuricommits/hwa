package runner

import (
	"fmt"
	"log"

	supabase "github.com/supabase-community/supabase-go"
	"github.com/yuricommits/hwa/analysis-engine/internal/extractor"
	"github.com/yuricommits/hwa/analysis-engine/internal/matcher"
	"github.com/yuricommits/hwa/analysis-engine/internal/staleness"
)

type ScanFile struct {
	ID       string `json:"id"`
	ScanID   string `json:"scan_id"`
	Filename string `json:"filename"`
	Content  string `json:"content"`
	Language string `json:"language"`
}

type Vulnerability struct {
	ScanID      string  `json:"scan_id"`
	FileID      string  `json:"file_id"`
	Type        string  `json:"type"`
	Severity    string  `json:"severity"`
	LineStart   *int    `json:"line_start"`
	LineEnd     *int    `json:"line_end"`
	Description string  `json:"description"`
	CveID       *string `json:"cve_id"`
	Suggestion  string  `json:"suggestion"`
}

func RunScan(db *supabase.Client, scanID string) error {
	// Mark as processing
	_, _, err := db.From("scans").
		Update(map[string]any{"status": "processing"}, "", "").
		Eq("id", scanID).
		Execute()
	if err != nil {
		return fmt.Errorf("failed to update scan status: %w", err)
	}

	// Fetch scan files
	var files []ScanFile
	_, err = db.From("scan_files").
		Select("*", "", false).
		Eq("scan_id", scanID).
		ExecuteTo(&files)
	if err != nil {
		markFailed(db, scanID)
		return fmt.Errorf("failed to fetch scan files: %w", err)
	}

	if len(files) == 0 {
		markFailed(db, scanID)
		return fmt.Errorf("no files found for scan %s", scanID)
	}

	var allVulns []Vulnerability

	for _, file := range files {
		// Extract packages
		packages := extractor.ExtractPackages(file.Content, file.Language)

		// Match CVEs
		cveVulns, err := matcher.MatchCves(db, packages)
		if err != nil {
			log.Printf("CVE matching failed for file %s: %v", file.ID, err)
		}

		// Check staleness
		stalenessVulns, err := staleness.CheckStaleness(db, file.Content, packages, file.Language)
		if err != nil {
			log.Printf("Staleness check failed for file %s: %v", file.ID, err)
		}

		for _, v := range append(cveVulns, stalenessVulns...) {
			allVulns = append(allVulns, Vulnerability{
				ScanID:      scanID,
				FileID:      file.ID,
				Type:        v.Type,
				Severity:    v.Severity,
				LineStart:   v.LineStart,
				LineEnd:     v.LineEnd,
				Description: v.Description,
				CveID:       v.CveID,
				Suggestion:  v.Suggestion,
			})
		}
	}

	// Insert vulnerabilities
	if len(allVulns) > 0 {
		_, _, err = db.From("vulnerabilities").
			Insert(allVulns, false, "", "", "").
			Execute()
		if err != nil {
			markFailed(db, scanID)
			return fmt.Errorf("failed to insert vulnerabilities: %w", err)
		}
	}

	// Mark completed
	_, _, err = db.From("scans").
		Update(map[string]any{
			"status":       "completed",
			"completed_at": "now()",
		}, "", "").
		Eq("id", scanID).
		Execute()
	if err != nil {
		return fmt.Errorf("failed to mark scan completed: %w", err)
	}

	log.Printf("Scan %s completed with %d vulnerabilities", scanID, len(allVulns))
	return nil
}

func markFailed(db *supabase.Client, scanID string) {
	db.From("scans").
		Update(map[string]any{"status": "failed"}, "", "").
		Eq("id", scanID).
		Execute()
}
