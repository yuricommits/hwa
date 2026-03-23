use regex::Regex;
use std::sync::LazyLock;

pub struct Pattern {
    pub regex: Regex,
    pub description: &'static str,
    pub suggestion: &'static str,
    pub severity: &'static str,
    pub languages: &'static [&'static str],
}

pub static PATTERNS: LazyLock<Vec<Pattern>> = LazyLock::new(|| {
    vec![
        // ── Cryptography ──────────────────────────────────────────────
        Pattern {
            regex: Regex::new(r#"createHash\s*\(\s*['"]md5['"]\s*\)"#).unwrap(), // hwa-ignore
            description: "MD5 is cryptographically broken",
            suggestion: "Use SHA-256 or bcrypt/argon2 for password hashing",
            severity: "critical",
            languages: &["typescript", "javascript"],
        },
        Pattern {
            regex: Regex::new(r"hashlib\.md5\s*\(").unwrap(), // hwa-ignore
            description: "MD5 is cryptographically broken",
            suggestion: "Use hashlib.sha256() or bcrypt/argon2",
            severity: "critical",
            languages: &["python"],
        },
        Pattern {
            regex: Regex::new(r#"createHash\s*\(\s*['"]sha1['"]\s*\)"#).unwrap(), // hwa-ignore
            description: "SHA1 is deprecated for security use by NIST",
            suggestion: "Use SHA-256 or higher",
            severity: "high",
            languages: &["typescript", "javascript"],
        },
        Pattern {
            regex: Regex::new(r"hashlib\.sha1\s*\(").unwrap(), // hwa-ignore
            description: "SHA1 is deprecated for security use by NIST",
            suggestion: "Use hashlib.sha256() or higher",
            severity: "high",
            languages: &["python"],
        },
        // ── SQL Injection ─────────────────────────────────────────────
        Pattern {
            regex: Regex::new(r"(?i)SELECT\s+.*\s+FROM\s+\w+\s+WHERE\s+.*\$\{").unwrap(), // hwa-ignore
            description: "Potential SQL injection — user input in query",
            suggestion: "Use parameterized queries or a query builder",
            severity: "critical",
            languages: &["typescript", "javascript"],
        },
        Pattern {
            regex: Regex::new(r#"(?i)(?:execute|cursor\.execute)\s*\(\s*f["'].*(?:username|password|email|id|input)"#).unwrap(), // hwa-ignore  
            description: "Potential SQL injection — f-string in SQL query",
            suggestion: "Use parameterized queries",
            severity: "critical",
            languages: &["python"],
        },
        // ── Command Injection ─────────────────────────────────────────
        Pattern {
            regex: Regex::new(r"subprocess\.(?:run|call|Popen)\s*\(.*shell\s*=\s*True").unwrap(), // hwa-ignore
            description: "Command injection risk — shell=True is dangerous",
            suggestion: "Use shell=False and pass args as a list",
            severity: "critical",
            languages: &["python"],
        },
        Pattern {
            regex: Regex::new(r"os\.system\s*\(").unwrap(), // hwa-ignore
            description: "os.system() is vulnerable to command injection",
            suggestion: "Use subprocess.run() with shell=False",
            severity: "critical",
            languages: &["python"],
        },
        // ── Unsafe Deserialization ────────────────────────────────────
        Pattern {
            regex: Regex::new(r"pickle\.loads?\s*\(").unwrap(), // hwa-ignore
            description: "Unsafe deserialization — pickle can execute arbitrary code",
            suggestion: "Use JSON or MessagePack instead of pickle",
            severity: "critical",
            languages: &["python"],
        },
        // ── SSL/TLS ───────────────────────────────────────────────────
        Pattern {
            regex: Regex::new(r"verify\s*=\s*False").unwrap(), // hwa-ignore
            description: "SSL verification disabled — vulnerable to MITM",
            suggestion: "Remove verify=False and use proper certificates",
            severity: "high",
            languages: &["python"],
        },
        Pattern {
            regex: Regex::new(r"rejectUnauthorized\s*:\s*false").unwrap(), // hwa-ignore
            description: "SSL verification disabled — vulnerable to MITM",
            suggestion: "Remove rejectUnauthorized: false",
            severity: "high",
            languages: &["typescript", "javascript"],
        },
        // ── Hardcoded Secrets (all languages) ────────────────────────
        Pattern {
            regex: Regex::new(r#"(?i)(?:password|passwd|pwd)\s*=\s*['"`][^'"`]{4,}['"`]"#).unwrap(), // hwa-ignore
            description: "Hardcoded password detected",
            suggestion: "Move to environment variables",
            severity: "critical",
            languages: &[],
        },
        Pattern {
            regex: Regex::new(r#"(?i)(?:api_key|apikey|api-key)\s*(?:=|:)\s*['"`][^'"`]{8,}['"`]"#).unwrap(), // hwa-ignore
            description: "Hardcoded API key detected",
            suggestion: "Move to environment variables and rotate immediately",
            severity: "critical",
            languages: &[],
        },
        Pattern {
            regex: Regex::new(r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{4,}(?:\.[a-zA-Z0-9_-]*)?").unwrap(), // hwa-ignore
            description: "Hardcoded JWT token detected",
            suggestion: "Remove JWT and rotate — it contains sensitive claims",
            severity: "critical",
            languages: &[],
        },
        Pattern {
            regex: Regex::new(r"(?:AKIA|AIPA|ASIA|AROA|AIDA)[A-Z0-9]{16}").unwrap(), // hwa-ignore
            description: "Hardcoded AWS access key detected",
            suggestion: "Revoke immediately and use IAM roles",
            severity: "critical",
            languages: &[],
        },
        Pattern {
            regex: Regex::new(r"ghp_[a-zA-Z0-9]{36}").unwrap(), // hwa-ignore
            description: "Hardcoded GitHub token detected",
            suggestion: "Revoke at github.com/settings/tokens",
            severity: "critical",
            languages: &[],
        },
        Pattern {
            regex: Regex::new(r"sk-[a-zA-Z0-9]{32,}").unwrap(), // hwa-ignore
            description: "Hardcoded API key (OpenAI/Stripe) detected",
            suggestion: "Revoke and rotate immediately",
            severity: "critical",
            languages: &[],
        },
        // ── Weak Randomness ───────────────────────────────────────────
        Pattern {
            regex: Regex::new(r"Math\.random\s*\(\s*\)").unwrap(), // hwa-ignore
            description: "Math.random() is not cryptographically secure",
            suggestion: "Use crypto.randomBytes() or crypto.randomUUID()",
            severity: "medium",
            languages: &["typescript", "javascript"],
        },
        Pattern {
            regex: Regex::new(r"random\.random\s*\(\s*\)").unwrap(), // hwa-ignore
            description: "random.random() is not cryptographically secure",
            suggestion: "Use secrets.token_bytes() or secrets.token_hex()",
            severity: "medium",
            languages: &["python"],
        },
        // ── Code Execution ────────────────────────────────────────────
        Pattern {
            regex: Regex::new(r"eval\s*\(").unwrap(), // hwa-ignore
            description: "eval() executes arbitrary code", // hwa-ignore
            suggestion: "Remove eval() and refactor",
            severity: "critical",
            languages: &[],
        },
        // ── Debug Mode ────────────────────────────────────────────────
        Pattern {
            regex: Regex::new(r"app\.run\s*\(.*debug\s*=\s*True").unwrap(), // hwa-ignore
            description: "Flask debug mode enabled in production",
            suggestion: "Set debug=False and use FLASK_ENV",
            severity: "high",
            languages: &["python"],
        },
        // ── Rust ──────────────────────────────────────────────────────
        Pattern {
            regex: Regex::new(r#"(?i)(?:api_key|apikey|api-key|secret|password|token)\s*=\s*"[^"]{4,}""#).unwrap(), // hwa-ignore
            description: "Hardcoded secret detected in Rust source",
            suggestion: "Use std::env::var() or the dotenvy crate",
            severity: "critical",
            languages: &["rust"],
        },
        Pattern {
            regex: Regex::new(r"unsafe\s*\{").unwrap(), // hwa-ignore
            description: "Unsafe block detected — bypasses Rust memory safety guarantees",
            suggestion: "Avoid unsafe blocks unless absolutely necessary",
            severity: "high",
            languages: &["rust"],
        },
        Pattern {
            regex: Regex::new(r"\.unwrap\(\)").unwrap(), // hwa-ignore
            description: "unwrap() will panic if the value is None or Err",
            suggestion: "Use match, if let, unwrap_or(), or ? operator instead",
            severity: "medium",
            languages: &["rust"],
        },
        Pattern {
            regex: Regex::new(r#"\.expect\s*\(\s*"[^"]*"\s*\)"#).unwrap(), // hwa-ignore
            description: "expect() will panic if the value is None or Err",
            suggestion: "Use proper error handling with match or the ? operator",
            severity: "medium",
            languages: &["rust"],
        },
        Pattern {
            regex: Regex::new(r"rand::random\s*::<").unwrap(), // hwa-ignore
            description: "rand::random is not cryptographically secure",
            suggestion: "Use rand::rngs::OsRng or the ring crate",
            severity: "medium",
            languages: &["rust"],
        },
    ]
});
