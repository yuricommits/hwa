package scanner

import "regexp"

type Pattern struct {
	Regex       *regexp.Regexp
	Description string
	Suggestion  string
	Severity    string
	Languages   []string
}

var Patterns = []Pattern{
	// ── Cryptography ──────────────────────────────────────────────
	{
		Regex:       regexp.MustCompile(`createHash\s*\(\s*['"]md5['"]\s*\)`),
		Description: "MD5 is cryptographically broken",
		Suggestion:  "Use SHA-256 or bcrypt/argon2 for password hashing",
		Severity:    "critical",
		Languages:   []string{"typescript", "javascript"},
	},
	{
		Regex:       regexp.MustCompile(`hashlib\.md5\s*\(`),
		Description: "MD5 is cryptographically broken",
		Suggestion:  "Use hashlib.sha256() or bcrypt/argon2",
		Severity:    "critical",
		Languages:   []string{"python"},
	},
	{
		Regex:       regexp.MustCompile(`createHash\s*\(\s*['"]sha1['"]\s*\)`),
		Description: "SHA1 is deprecated for security use by NIST",
		Suggestion:  "Use SHA-256 or higher",
		Severity:    "high",
		Languages:   []string{"typescript", "javascript"},
	},
	{
		Regex:       regexp.MustCompile(`hashlib\.sha1\s*\(`),
		Description: "SHA1 is deprecated for security use by NIST",
		Suggestion:  "Use hashlib.sha256() or higher",
		Severity:    "high",
		Languages:   []string{"python"},
	},

	// ── SQL Injection ─────────────────────────────────────────────
	{
		Regex:       regexp.MustCompile(`(?i)SELECT\s+.*\s+FROM\s+\w+\s+WHERE\s+.*\$\{`),
		Description: "Potential SQL injection — user input in query",
		Suggestion:  "Use parameterized queries or a query builder",
		Severity:    "critical",
		Languages:   []string{"typescript", "javascript"},
	},
	{
		Regex:       regexp.MustCompile(`(?i)(?:execute|cursor\.execute)\s*\(\s*f['""].*(?:username|password|email|id|input)`),
		Description: "Potential SQL injection — f-string in SQL query",
		Suggestion:  "Use parameterized queries: cursor.execute('...', (val,))",
		Severity:    "critical",
		Languages:   []string{"python"},
	},

	// ── Command Injection ─────────────────────────────────────────
	{
		Regex:       regexp.MustCompile(`subprocess\.(run|call|Popen)\s*\(.*shell\s*=\s*True`),
		Description: "Command injection risk — shell=True is dangerous",
		Suggestion:  "Use shell=False and pass args as a list",
		Severity:    "critical",
		Languages:   []string{"python"},
	},
	{
		Regex:       regexp.MustCompile(`os\.system\s*\(`),
		Description: "os.system() is vulnerable to command injection",
		Suggestion:  "Use subprocess.run() with shell=False",
		Severity:    "critical",
		Languages:   []string{"python"},
	},

	// ── Unsafe Deserialization ────────────────────────────────────
	{
		Regex:       regexp.MustCompile(`pickle\.loads?\s*\(`),
		Description: "Unsafe deserialization — pickle can execute arbitrary code",
		Suggestion:  "Use JSON or MessagePack instead of pickle",
		Severity:    "critical",
		Languages:   []string{"python"},
	},
	{
		Regex:       regexp.MustCompile(`yaml\.load\s*\([^,)]+\)`),
		Description: "Unsafe YAML deserialization",
		Suggestion:  "Use yaml.safe_load() instead",
		Severity:    "critical",
		Languages:   []string{"python"},
	},

	// ── SSL/TLS ───────────────────────────────────────────────────
	{
		Regex:       regexp.MustCompile(`verify\s*=\s*False`),
		Description: "SSL verification disabled — vulnerable to MITM",
		Suggestion:  "Remove verify=False and use proper certificates",
		Severity:    "high",
		Languages:   []string{"python"},
	},
	{
		Regex:       regexp.MustCompile(`rejectUnauthorized\s*:\s*false`),
		Description: "SSL verification disabled — vulnerable to MITM",
		Suggestion:  "Remove rejectUnauthorized: false",
		Severity:    "high",
		Languages:   []string{"typescript", "javascript"},
	},

	// ── Hardcoded Secrets (all languages) ────────────────────────
	{
		Regex:       regexp.MustCompile(`(?i)(?:password|passwd|pwd)\s*=\s*['` + "`" + `"][^'` + "`" + `"]{4,}['` + "`" + `"]`),
		Description: "Hardcoded password detected",
		Suggestion:  "Move to environment variables",
		Severity:    "critical",
	},
	{
		Regex:       regexp.MustCompile(`(?i)(?:secret|api_secret|client_secret)\s*=\s*['` + "`" + `"][^'` + "`" + `"]{4,}['` + "`" + `"]`),
		Description: "Hardcoded secret detected",
		Suggestion:  "Move to environment variables",
		Severity:    "critical",
	},
	{
		Regex:       regexp.MustCompile(`(?i)(?:api_key|apikey|api-key)\s*(?:=|:)\s*['` + "`" + `"][^'` + "`" + `"]{8,}['` + "`" + `"]`),
		Description: "Hardcoded API key detected",
		Suggestion:  "Move to environment variables and rotate immediately",
		Severity:    "critical",
	},
	{
		Regex:       regexp.MustCompile(`eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{4,}(?:\.[a-zA-Z0-9_\-]*)?`),
		Description: "Hardcoded JWT token detected",
		Suggestion:  "Remove JWT and rotate — it contains sensitive claims",
		Severity:    "critical",
	},
	{
		Regex:       regexp.MustCompile(`(?:AKIA|AIPA|ASIA|AROA|AIDA)[A-Z0-9]{16}`),
		Description: "Hardcoded AWS access key detected",
		Suggestion:  "Revoke immediately and use IAM roles",
		Severity:    "critical",
	},
	{
		Regex:       regexp.MustCompile(`ghp_[a-zA-Z0-9]{36}`),
		Description: "Hardcoded GitHub token detected",
		Suggestion:  "Revoke at github.com/settings/tokens",
		Severity:    "critical",
	},
	{
		Regex:       regexp.MustCompile(`sk-[a-zA-Z0-9]{32,}`),
		Description: "Hardcoded API key (OpenAI/Stripe) detected",
		Suggestion:  "Revoke and rotate immediately",
		Severity:    "critical",
	},

	// ── Weak Randomness ───────────────────────────────────────────
	{
		Regex:       regexp.MustCompile(`Math\.random\s*\(\s*\)`),
		Description: "Math.random() is not cryptographically secure",
		Suggestion:  "Use crypto.randomBytes() or crypto.randomUUID()",
		Severity:    "medium",
		Languages:   []string{"typescript", "javascript"},
	},
	{
		Regex:       regexp.MustCompile(`random\.random\s*\(\s*\)`),
		Description: "random.random() is not cryptographically secure",
		Suggestion:  "Use secrets.token_bytes() or secrets.token_hex()",
		Severity:    "medium",
		Languages:   []string{"python"},
	},

	// ── Code Execution ────────────────────────────────────────────
	{
		Regex:       regexp.MustCompile(`eval\s*\(`),
		Description: "eval() executes arbitrary code",
		Suggestion:  "Remove eval() and refactor",
		Severity:    "critical",
	},
	{
		Regex:       regexp.MustCompile(`\bexec\s*\(`),
		Description: "exec() executes arbitrary code",
		Suggestion:  "Remove exec() and refactor",
		Severity:    "critical",
		Languages:   []string{"python"},
	},

	// ── Debug Mode ────────────────────────────────────────────────
	{
		Regex:       regexp.MustCompile(`app\.run\s*\(.*debug\s*=\s*True`),
		Description: "Flask debug mode enabled in production",
		Suggestion:  "Set debug=False and use FLASK_ENV",
		Severity:    "high",
		Languages:   []string{"python"},
	},
}
