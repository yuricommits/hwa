import { serviceClient } from "@/lib/supabase/service";
import type { ExtractedPackage, VulnerabilityResult } from "@hwa/types";

const CODE_PATTERNS: Array<{
  pattern: RegExp;
  description: string;
  suggestion: string;
  severity: VulnerabilityResult["severity"];
}> = [
  // Cryptography
  {
    pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/g,
    description:
      "MD5 is cryptographically broken and must not be used for security purposes",
    suggestion: "Use SHA-256 or bcrypt/argon2 for password hashing",
    severity: "critical",
  },
  {
    pattern: /createHash\s*\(\s*['"]sha1['"]\s*\)/g,
    description: "SHA1 is deprecated for security use cases by NIST",
    suggestion: "Use SHA-256 or higher for cryptographic operations",
    severity: "high",
  },

  // Injection
  {
    pattern: /SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+\w+\s*=\s*['"]\s*\$\{/gi,
    description:
      "Potential SQL injection — user input interpolated directly into query",
    suggestion: "Use parameterized queries or a query builder",
    severity: "critical",
  },
  {
    pattern: /eval\s*\(/g,
    description:
      "eval() executes arbitrary code and is a critical security risk",
    suggestion: "Remove eval() — refactor to avoid dynamic code execution",
    severity: "critical",
  },

  // Weak randomness
  {
    pattern: /Math\.random\s*\(\s*\)/g,
    description: "Math.random() is not cryptographically secure",
    suggestion: "Use crypto.randomBytes() or crypto.randomUUID() instead",
    severity: "medium",
  },

  // Hardcoded secrets
  {
    pattern:
      /(['"`])(?:password|passwd|pwd)\s*(?:=|:)\s*['"`][^'"`]{4,}['"`]/gi,
    description: "Hardcoded password detected in source code",
    suggestion:
      "Move credentials to environment variables and never commit secrets",
    severity: "critical",
  },
  {
    pattern:
      /(['"`])(?:secret|api_secret|client_secret)\s*(?:=|:)\s*['"`][^'"`]{4,}['"`]/gi,
    description: "Hardcoded secret detected in source code",
    suggestion:
      "Move secrets to environment variables — use a secrets manager in production",
    severity: "critical",
  },
  {
    pattern: /(?:api_key|apikey|api-key)\s*(?:=|:)\s*['"`][^'"`]{8,}['"`]/gi,
    description: "Hardcoded API key detected in source code",
    suggestion:
      "Move API keys to environment variables and rotate the exposed key immediately",
    severity: "critical",
  },
  {
    pattern:
      /(?:token|auth_token|access_token)\s*(?:=|:)\s*['"`][a-zA-Z0-9_\-\.]{16,}['"`]/g,
    description: "Hardcoded token detected in source code",
    suggestion:
      "Move tokens to environment variables and rotate the exposed token immediately",
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
    pattern: /(?:AKIA|AIPA|ASIA|AROA|AIDA|ANIA)[A-Z0-9]{16}/g,
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

  // Environment variable misuse
  {
    pattern: /process\.env\.[A-Z_]+\s*[^|!?]/g,
    description: "Environment variable accessed without fallback or validation",
    suggestion:
      "Validate environment variables at startup and provide fallbacks",
    severity: "low",
  },
];

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}

export async function checkStaleness(
  content: string,
  packages: ExtractedPackage[],
): Promise<VulnerabilityResult[]> {
  const results: VulnerabilityResult[] = [];

  // Check code patterns directly
  for (const check of CODE_PATTERNS) {
    check.pattern.lastIndex = 0;
    let match;
    while ((match = check.pattern.exec(content)) !== null) {
      results.push({
        type: "staleness",
        severity: check.severity,
        lineStart: getLineNumber(content, match.index),
        lineEnd: getLineNumber(content, match.index),
        description: check.description,
        cveId: null,
        suggestion: check.suggestion,
      });
    }
  }

  // Check packages against staleness records
  for (const pkg of packages) {
    const { data: packageRecord } = await serviceClient
      .from("packages")
      .select("id")
      .eq("name", pkg.name)
      .eq("ecosystem", pkg.ecosystem)
      .single();

    if (!packageRecord) continue;

    const { data: records } = await serviceClient
      .from("staleness_records")
      .select("*")
      .eq("package_id", packageRecord.id);

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
