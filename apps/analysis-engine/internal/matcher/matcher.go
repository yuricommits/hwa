package matcher

import (
	"fmt"

	supabase "github.com/supabase-community/supabase-go"
	"github.com/yuricommits/hwa/analysis-engine/internal/extractor"
	"github.com/yuricommits/hwa/analysis-engine/internal/types"
)

type packageRecord struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type cveRecord struct {
	CveID          string  `json:"cve_id"`
	Severity       string  `json:"severity"`
	Description    string  `json:"description"`
	PatchedVersion *string `json:"patched_version"`
}

func MatchCves(db *supabase.Client, packages []extractor.Package) ([]types.VulnerabilityResult, error) {
	var results []types.VulnerabilityResult

	for _, pkg := range packages {
		var pkgRecords []packageRecord
		_, err := db.From("packages").
			Select("id, name", "", false).
			Eq("name", pkg.Name).
			Eq("ecosystem", pkg.Ecosystem).
			ExecuteTo(&pkgRecords)
		if err != nil || len(pkgRecords) == 0 {
			continue
		}

		pkgRecord := pkgRecords[0]

		var cves []cveRecord
		_, err = db.From("cve_records").
			Select("cve_id, severity, description, patched_version", "", false).
			Eq("package_id", pkgRecord.ID).
			ExecuteTo(&cves)
		if err != nil || len(cves) == 0 {
			continue
		}

		for _, cve := range cves {
			line := pkg.Line
			cveID := cve.CveID
			suggestion := fmt.Sprintf("Review and update %s", pkg.Name)
			if cve.PatchedVersion != nil {
				suggestion = fmt.Sprintf("Upgrade to %s@%s or later", pkg.Name, *cve.PatchedVersion)
			}

			results = append(results, types.VulnerabilityResult{
				Type:        "security",
				Severity:    cve.Severity,
				LineStart:   &line,
				LineEnd:     &line,
				Description: fmt.Sprintf("%s: %s", pkg.Name, cve.Description),
				CveID:       &cveID,
				Suggestion:  suggestion,
			})
		}
	}

	return results, nil
}
