package types

type VulnerabilityResult struct {
	Type        string
	Severity    string
	LineStart   *int
	LineEnd     *int
	Description string
	CveID       *string
	Suggestion  string
}
