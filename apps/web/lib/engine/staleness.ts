import { getServiceClient } from "@/lib/supabase/service";

interface CodePattern {
  pattern: RegExp;
  description: string;
  suggestion: string;
  severity: "critical" | "high" | "medium" | "low";
  languages?: string[];
}

interface VulnerabilityResult {
  type: string;
  severity: string;
  lineStart: number;
  lineEnd: number;
  description: string;
  cveId: null;
  suggestion: string;
}

const CODE_PATTERNS: CodePattern[] = [
  // ── Cryptography ──────────────────────────────────────────────
  {
    pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/g,
    description:
      "MD5 is cryptographically broken and must not be used for security purposes",
    suggestion: "Use SHA-256 or bcrypt/argon2 for password hashing",
    severity: "critical",
    languages: ["typescript", "javascript"],
  },
  {
    pattern: /hashlib\.md5\s*\(/g,
    description:
      "MD5 is cryptographically broken and must not be used for security purposes",
    suggestion: "Use hashlib.sha256() or bcrypt/argon2 for password hashing",
    severity: "critical",
    languages: ["python"],
  },
  {
    pattern: /createHash\s*\(\s*['"]sha1['"]\s*\)/g,
    description: "SHA1 is deprecated for security use cases by NIST",
    suggestion: "Use SHA-256 or higher for cryptographic operations",
    severity: "high",
    languages: ["typescript", "javascript"],
  },
  {
    pattern: /hashlib\.sha1\s*\(/g,
    description: "SHA1 is deprecated for security use cases by NIST",
    suggestion: "Use hashlib.sha256() or higher for cryptographic operations",
    severity: "high",
    languages: ["python"],
  },

  // ── SQL Injection ─────────────────────────────────────────────
  {
    pattern: /SELECT\s+.*\s+FROM\s+\w+\s+WHERE\s+.*\$\{/gi,
    description:
      "Potential SQL injection — user input interpolated directly into query",
    suggestion: "Use parameterized queries or a query builder",
    severity: "critical",
    languages: ["typescript", "javascript"],
  },
  {
    pattern:
      /(?:execute|cursor\.execute)\s*\(\s*f['""].*(?:username|password|email|id|input)/gi,
    description:
      "Potential SQL injection — f-string used in SQL query with user input",
    suggestion:
      "Use parameterized queries: cursor.execute('SELECT * FROM users WHERE id = ?', (id,))",
    severity: "critical",
    languages: ["python"],
  },
  {
    pattern: /(?:execute|cursor\.execute)\s*\(\s*['"].*%s.*['"].*%/gi,
    description:
      "Potential SQL injection — string formatting used in SQL query",
    suggestion: "Use parameterized queries instead of string formatting",
    severity: "critical",
    languages: ["python"],
  },

  // ── Command Injection ─────────────────────────────────────────
  {
    pattern: /subprocess\.(run|call|Popen)\s*\(.*shell\s*=\s*True/g,
    description:
      "Command injection risk — shell=True with user input is dangerous",
    suggestion:
      "Use shell=False and pass arguments as a list: subprocess.run(['cmd', arg])",
    severity: "critical",
    languages: ["python"],
  },
  {
    pattern: /os\.system\s*\(/g,
    description: "os.system() is vulnerable to command injection",
    suggestion: "Use subprocess.run() with shell=False instead",
    severity: "critical",
    languages: ["python"],
  },

  // ── Unsafe Deserialization ────────────────────────────────────
  {
    pattern: /pickle\.loads?\s*\(/g,
    description:
      "Unsafe deserialization — pickle.load() can execute arbitrary code",
    suggestion:
      "Never deserialize untrusted data with pickle — use JSON or MessagePack instead",
    severity: "critical",
    languages: ["python"],
  },
  {
    pattern: /yaml\.load\s*\([^,)]+\)/g,
    description:
      "Unsafe YAML deserialization — yaml.load() without Loader can execute arbitrary code",
    suggestion: "Use yaml.safe_load() instead of yaml.load()",
    severity: "critical",
    languages: ["python"],
  },

  // ── SSL/TLS ───────────────────────────────────────────────────
  {
    pattern: /verify\s*=\s*False/g,
    description:
      "SSL certificate verification disabled — vulnerable to MITM attacks",
    suggestion: "Remove verify=False and use proper SSL certificates",
    severity: "high",
    languages: ["python"],
  },
  {
    pattern: /rejectUnauthorized\s*:\s*false/g,
    description:
      "SSL certificate verification disabled — vulnerable to MITM attacks",
    suggestion:
      "Remove rejectUnauthorized: false and use proper SSL certificates",
    severity: "high",
    languages: ["typescript", "javascript"],
  },

  // ── Hardcoded Secrets (all languages) ────────────────────────
  {
    pattern: /(?:password|passwd|pwd)\s*=\s*['`"][^'`"]{4,}['`"]/gi,
    description: "Hardcoded password detected in source code",
    suggestion:
      "Move credentials to environment variables and never commit secrets",
    severity: "critical",
  },
  {
    pattern: /(?:secret|api_secret|client_secret)\s*=\s*['`"][^'`"]{4,}['`"]/gi,
    description: "Hardcoded secret detected in source code",
    suggestion:
      "Move secrets to environment variables — use a secrets manager in production",
    severity: "critical",
  },
  {
    pattern: /(?:api_key|apikey|api-key)\s*(?:=|:)\s*['`"][^'`"]{8,}['`"]/gi,
    description: "Hardcoded API key detected in source code",
    suggestion:
      "Move API keys to environment variables and rotate the exposed key immediately",
    severity: "critical",
  },
  {
    pattern:
      /eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{4,}(?:\.[a-zA-Z0-9_\-]*)?/g,
    description: "Hardcoded JWT token detected in source code",
    suggestion:
      "Remove the JWT — it likely contains sensitive claims and must be rotated",
    severity: "critical",
  },
  {
    pattern: /(?:AKIA|AIPA|ASIA|AROA|AIDA)[A-Z0-9]{16}/g,
    description: "Hardcoded AWS access key detected",
    suggestion:
      "Revoke this AWS key immediately and move credentials to IAM roles or environment variables",
    severity: "critical",
  },
  {
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    description: "Hardcoded GitHub personal access token detected",
    suggestion: "Revoke this token immediately at github.com/settings/tokens",
    severity: "critical",
  },
  {
    pattern: /sk-[a-zA-Z0-9]{32,}/g,
    description:
      "Hardcoded API key detected (possible OpenAI or Stripe secret key)",
    suggestion:
      "Revoke and rotate this key immediately — move to environment variables",
    severity: "critical",
  },

  // ── Weak Randomness ───────────────────────────────────────────
  {
    pattern: /Math\.random\s*\(\s*\)/g,
    description: "Math.random() is not cryptographically secure",
    suggestion: "Use crypto.randomBytes() or crypto.randomUUID() instead",
    severity: "medium",
    languages: ["typescript", "javascript"],
  },
  {
    pattern: /random\.random\s*\(\s*\)/g,
    description: "random.random() is not cryptographically secure",
    suggestion:
      "Use secrets.token_bytes() or secrets.token_hex() for cryptographic randomness",
    severity: "medium",
    languages: ["python"],
  },

  // ── Code Execution ────────────────────────────────────────────
  {
    pattern: /eval\s*\(/g,
    description:
      "eval() executes arbitrary code and is a critical security risk",
    suggestion: "Remove eval() — refactor to avoid dynamic code execution",
    severity: "critical",
  },
  {
    pattern: /\bexec\s*\(/g,
    description:
      "exec() executes arbitrary code and is a critical security risk",
    suggestion: "Remove exec() — refactor to avoid dynamic code execution",
    severity: "critical",
    languages: ["python"],
  },

  // ── Debug Mode ────────────────────────────────────────────────
  {
    pattern: /app\.run\s*\(.*debug\s*=\s*True/g,
    description:
      "Flask debug mode enabled — exposes interactive debugger in production",
    suggestion:
      "Set debug=False in production and use FLASK_ENV environment variable",
    severity: "high",
    languages: ["python"],
  },

  // ── Rust ─────────────────────────────────────────────────────
  {
    pattern:
      /(?:api_key|apikey|api-key|secret|password|token)\s*=\s*"[^"]{4,}"/gi,
    description: "Hardcoded secret detected in Rust source",
    suggestion:
      "Use environment variables via std::env::var() or the dotenvy crate",
    severity: "critical" as const,
    languages: ["rust"],
  },
  {
    pattern: /unsafe\s*\{/g,
    description:
      "Unsafe block detected — bypasses Rust memory safety guarantees",
    suggestion:
      "Avoid unsafe blocks unless absolutely necessary and document why",
    severity: "high" as const,
    languages: ["rust"],
  },
  {
    pattern: /\.unwrap\(\)/g,
    description: "unwrap() will panic if the value is None or Err",
    suggestion: "Use match, if let, unwrap_or(), or ? operator instead",
    severity: "medium" as const,
    languages: ["rust"],
  },
  {
    pattern: /\.expect\s*\(\s*"[^"]*"\s*\)/g,
    description: "expect() will panic if the value is None or Err",
    suggestion: "Use proper error handling with match or the ? operator",
    severity: "medium" as const,
    languages: ["rust"],
  },
  {
    pattern: /rand::random\s*::</g,
    description: "rand::random is not cryptographically secure",
    suggestion:
      "Use rand::rngs::OsRng or the ring crate for cryptographic randomness",
    severity: "medium" as const,
    languages: ["rust"],
  },
  {
    pattern: /println!\s*\(.*(?:password|secret|token|key)/gi,
    description: "Possible sensitive data being printed to stdout",
    suggestion: "Remove debug prints containing sensitive data before shipping",
    severity: "medium" as const,
    languages: ["rust"],
  },
];

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function matchesLanguage(pattern: CodePattern, language: string): boolean {
  if (!pattern.languages || pattern.languages.length === 0) return true;
  return pattern.languages.includes(language);
}

export async function checkStaleness(
  content: string,
  packages: Array<{ name: string; ecosystem: string; line: number }>,
  language: string,
): Promise<VulnerabilityResult[]> {
  const results: VulnerabilityResult[] = [];

  // Check code patterns
  for (const check of CODE_PATTERNS) {
    if (!matchesLanguage(check, language)) continue;

    const pattern = new RegExp(check.pattern.source, check.pattern.flags);
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      results.push({
        type: "staleness",
        severity: check.severity,
        lineStart: line,
        lineEnd: line,
        description: check.description,
        cveId: null,
        suggestion: check.suggestion,
      });
    }
  }

  // Check packages against staleness records
  const supabase = getServiceClient();

  for (const pkg of packages) {
    const { data: pkgRecords } = await supabase
      .from("packages")
      .select("id")
      .eq("name", pkg.name)
      .eq("ecosystem", pkg.ecosystem)
      .limit(1);

    if (!pkgRecords || pkgRecords.length === 0 || !pkgRecords[0]) continue;

    const { data: records } = await supabase
      .from("staleness_records")
      .select("became_stale_at, reason, replacement")
      .eq("package_id", pkgRecords[0].id);

    if (!records || records.length === 0) continue;

    for (const record of records) {
      const staleDate = new Date(record.became_stale_at);
      const yearsStale = Math.floor(
        (Date.now() - staleDate.getTime()) / (1000 * 60 * 60 * 24 * 365),
      );

      results.push({
        type: "staleness",
        severity: yearsStale >= 3 ? "high" : "medium",
        lineStart: pkg.line,
        lineEnd: pkg.line,
        description: `${pkg.name} is stale: ${record.reason}`,
        cveId: null,
        suggestion: record.replacement,
      });
    }
  }

  return results;
}
