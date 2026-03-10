package staleness

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"

	supabase "github.com/supabase-community/supabase-go"
	"github.com/yuricommits/hwa/analysis-engine/internal/extractor"
	"github.com/yuricommits/hwa/analysis-engine/internal/types"
)

type codePattern struct {
	pattern     *regexp.Regexp
	description string
	suggestion  string
	severity    string
	languages   []string // empty = all languages
}

type stalenessRecord struct {
	BecameStaleAt string `json:"became_stale_at"`
	Reason        string `json:"reason"`
	Replacement   string `json:"replacement"`
}

type packageRecord struct {
	ID string `json:"id"`
}

var codePatterns = []codePattern{
	// ── Cryptography ──────────────────────────────────────────────
	{
		pattern:     regexp.MustCompile(`createHash\s*\(\s*['"]md5['"]\s*\)`),
		description: "MD5 is cryptographically broken and must not be used for security purposes",
		suggestion:  "Use SHA-256 or bcrypt/argon2 for password hashing",
		severity:    "critical",
		languages:   []string{"typescript", "javascript"},
	},
	{
		pattern:     regexp.MustCompile(`hashlib\.md5\s*\(`),
		description: "MD5 is cryptographically broken and must not be used for security purposes",
		suggestion:  "Use hashlib.sha256() or bcrypt/argon2 for password hashing",
		severity:    "critical",
		languages:   []string{"python"},
	},
	{
		pattern:     regexp.MustCompile(`createHash\s*\(\s*['"]sha1['"]\s*\)`),
		description: "SHA1 is deprecated for security use cases by NIST",
		suggestion:  "Use SHA-256 or higher for cryptographic operations",
		severity:    "high",
		languages:   []string{"typescript", "javascript"},
	},
	{
		pattern:     regexp.MustCompile(`hashlib\.sha1\s*\(`),
		description: "SHA1 is deprecated for security use cases by NIST",
		suggestion:  "Use hashlib.sha256() or higher for cryptographic operations",
		severity:    "high",
		languages:   []string{"python"},
	},

	// ── SQL Injection ─────────────────────────────────────────────
	{
		pattern:     regexp.MustCompile(`(?i)SELECT\s+.*\s+FROM\s+\w+\s+WHERE\s+.*\$\{`),
		description: "Potential SQL injection — user input interpolated directly into query",
		suggestion:  "Use parameterized queries or a query builder",
		severity:    "critical",
		languages:   []string{"typescript", "javascript"},
	},
	{
		pattern:     regexp.MustCompile(`(?i)(?:execute|cursor\.execute)\s*\(\s*f['""].*(?:username|password|email|id|input)`),
		description: "Potential SQL injection — f-string used in SQL query with user input",
		suggestion:  "Use parameterized queries: cursor.execute('SELECT * FROM users WHERE id = ?', (id,))",
		severity:    "critical",
		languages:   []string{"python"},
	},
	{
		pattern:     regexp.MustCompile(`(?i)(?:execute|cursor\.execute)\s*\(\s*['""].*%s.*['""].*%`),
		description: "Potential SQL injection — string formatting used in SQL query",
		suggestion:  "Use parameterized queries instead of string formatting",
		severity:    "critical",
		languages:   []string{"python"},
	},

	// ── Command Injection ─────────────────────────────────────────
	{
		pattern:     regexp.MustCompile(`subprocess\.(run|call|Popen)\s*\(.*shell\s*=\s*True`),
		description: "Command injection risk — shell=True with user input is dangerous",
		suggestion:  "Use shell=False and pass arguments as a list: subprocess.run(['cmd', arg])",
		severity:    "critical",
		languages:   []string{"python"},
	},
	{
		pattern:     regexp.MustCompile(`os\.system\s*\(`),
		description: "os.system() is vulnerable to command injection",
		suggestion:  "Use subprocess.run() with shell=False instead",
		severity:    "critical",
		languages:   []string{"python"},
	},

	// ── Unsafe Deserialization ────────────────────────────────────
	{
		pattern:     regexp.MustCompile(`pickle\.loads?\s*\(`),
		description: "Unsafe deserialization — pickle.load() can execute arbitrary code",
		suggestion:  "Never deserialize untrusted data with pickle — use JSON or MessagePack instead",
		severity:    "critical",
		languages:   []string{"python"},
	},
	{
		pattern:     regexp.MustCompile(`yaml\.load\s*\([^,)]+\)`),
		description: "Unsafe YAML deserialization — yaml.load() without Loader can execute arbitrary code",
		suggestion:  "Use yaml.safe_load() instead of yaml.load()",
		severity:    "critical",
		languages:   []string{"python"},
	},

	// ── SSL/TLS ───────────────────────────────────────────────────
	{
		pattern:     regexp.MustCompile(`verify\s*=\s*False`),
		description: "SSL certificate verification disabled — vulnerable to MITM attacks",
		suggestion:  "Remove verify=False and use proper SSL certificates",
		severity:    "high",
		languages:   []string{"python"},
	},
	{
		pattern:     regexp.MustCompile(`rejectUnauthorized\s*:\s*false`),
		description: "SSL certificate verification disabled — vulnerable to MITM attacks",
		suggestion:  "Remove rejectUnauthorized: false and use proper SSL certificates",
		severity:    "high",
		languages:   []string{"typescript", "javascript"},
	},

	// ── Hardcoded Secrets (all languages) ────────────────────────
	{
		pattern:     regexp.MustCompile(`(?i)(?:password|passwd|pwd)\s*=\s*['` + "`" + `"][^'` + "`" + `"]{4,}['` + "`" + `"]`),
		description: "Hardcoded password detected in source code",
		suggestion:  "Move credentials to environment variables and never commit secrets",
		severity:    "critical",
	},
	{
		pattern:     regexp.MustCompile(`(?i)(?:secret|api_secret|client_secret)\s*=\s*['` + "`" + `"][^'` + "`" + `"]{4,}['` + "`" + `"]`),
		description: "Hardcoded secret detected in source code",
		suggestion:  "Move secrets to environment variables — use a secrets manager in production",
		severity:    "critical",
	},
	{
		pattern:     regexp.MustCompile(`(?i)(?:api_key|apikey|api-key)\s*(?:=|:)\s*['` + "`" + `"][^'` + "`" + `"]{8,}['` + "`" + `"]`),
		description: "Hardcoded API key detected in source code",
		suggestion:  "Move API keys to environment variables and rotate the exposed key immediately",
		severity:    "critical",
	},
	{
		pattern:     regexp.MustCompile(`eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{4,}(?:\.[a-zA-Z0-9_\-]*)?`),
		description: "Hardcoded JWT token detected in source code",
		suggestion:  "Remove the JWT — it likely contains sensitive claims and must be rotated",
		severity:    "critical",
	},
	{
		pattern:     regexp.MustCompile(`(?:AKIA|AIPA|ASIA|AROA|AIDA)[A-Z0-9]{16}`),
		description: "Hardcoded AWS access key detected",
		suggestion:  "Revoke this AWS key immediately and move credentials to IAM roles or environment variables",
		severity:    "critical",
	},
	{
		pattern:     regexp.MustCompile(`ghp_[a-zA-Z0-9]{36}`),
		description: "Hardcoded GitHub personal access token detected",
		suggestion:  "Revoke this token immediately at github.com/settings/tokens",
		severity:    "critical",
	},
	{
		pattern:     regexp.MustCompile(`sk-[a-zA-Z0-9]{32,}`),
		description: "Hardcoded API key detected (possible OpenAI or Stripe secret key)",
		suggestion:  "Revoke and rotate this key immediately — move to environment variables",
		severity:    "critical",
	},

	// ── Weak Randomness ───────────────────────────────────────────
	{
		pattern:     regexp.MustCompile(`Math\.random\s*\(\s*\)`),
		description: "Math.random() is not cryptographically secure",
		suggestion:  "Use crypto.randomBytes() or crypto.randomUUID() instead",
		severity:    "medium",
		languages:   []string{"typescript", "javascript"},
	},
	{
		pattern:     regexp.MustCompile(`random\.random\s*\(\s*\)`),
		description: "random.random() is not cryptographically secure",
		suggestion:  "Use secrets.token_bytes() or secrets.token_hex() for cryptographic randomness",
		severity:    "medium",
		languages:   []string{"python"},
	},

	// ── Code Execution ────────────────────────────────────────────
	{
		pattern:     regexp.MustCompile(`eval\s*\(`),
		description: "eval() executes arbitrary code and is a critical security risk",
		suggestion:  "Remove eval() — refactor to avoid dynamic code execution",
		severity:    "critical",
	},
	{
		pattern:     regexp.MustCompile(`exec\s*\(`),
		description: "exec() executes arbitrary code and is a critical security risk",
		suggestion:  "Remove exec() — refactor to avoid dynamic code execution",
		severity:    "critical",
		languages:   []string{"python"},
	},

	// ── Debug Mode ────────────────────────────────────────────────
	{
		pattern:     regexp.MustCompile(`app\.run\s*\(.*debug\s*=\s*True`),
		description: "Flask debug mode enabled — exposes interactive debugger in production",
		suggestion:  "Set debug=False in production and use FLASK_ENV environment variable",
		severity:    "high",
		languages:   []string{"python"},
	},
}

func lineNumber(content string, index int) int {
	return strings.Count(content[:index], "\n") + 1
}

func matchesLanguage(pattern codePattern, language string) bool {
	if len(pattern.languages) == 0 {
		return true
	}
	for _, l := range pattern.languages {
		if l == language {
			return true
		}
	}
	return false
}

func CheckStaleness(db *supabase.Client, content string, packages []extractor.Package, language string) ([]types.VulnerabilityResult, error) {
	var results []types.VulnerabilityResult

	// Check code patterns
	for _, check := range codePatterns {
		if !matchesLanguage(check, language) {
			continue
		}
		for _, loc := range check.pattern.FindAllStringIndex(content, -1) {
			line := lineNumber(content, loc[0])
			results = append(results, types.VulnerabilityResult{
				Type:        "staleness",
				Severity:    check.severity,
				LineStart:   &line,
				LineEnd:     &line,
				Description: check.description,
				CveID:       nil,
				Suggestion:  check.suggestion,
			})
		}
	}

	// Check packages against staleness records
	for _, pkg := range packages {
		var pkgRecords []packageRecord
		_, err := db.From("packages").
			Select("id", "", false).
			Eq("name", pkg.Name).
			Eq("ecosystem", pkg.Ecosystem).
			ExecuteTo(&pkgRecords)
		if err != nil || len(pkgRecords) == 0 {
			continue
		}

		var records []stalenessRecord
		_, err = db.From("staleness_records").
			Select("became_stale_at, reason, replacement", "", false).
			Eq("package_id", pkgRecords[0].ID).
			ExecuteTo(&records)
		if err != nil || len(records) == 0 {
			continue
		}

		for _, record := range records {
			staleDate, err := time.Parse(time.RFC3339, record.BecameStaleAt)
			if err != nil {
				continue
			}

			yearsStale := math.Floor(time.Since(staleDate).Hours() / 24 / 365)
			severity := "medium"
			if yearsStale >= 3 {
				severity = "high"
			}

			line := pkg.Line
			description := fmt.Sprintf("%s is stale: %s", pkg.Name, record.Reason)

			results = append(results, types.VulnerabilityResult{
				Type:        "staleness",
				Severity:    severity,
				LineStart:   &line,
				LineEnd:     &line,
				Description: description,
				CveID:       nil,
				Suggestion:  record.Replacement,
			})
		}
	}

	return results, nil
}
