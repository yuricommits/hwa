# hwa

AI code vulnerability tracker. Detects CVEs, staleness, and hardcoded secrets in AI-generated code.

**[hwa-kappa.vercel.app](https://hwa-kappa.vercel.app)**

---

## What it does

AI-generated code ships fast but often contains security issues — hardcoded secrets, deprecated cryptography, SQL injection, and packages with known CVEs. hwa catches these before they reach production.

## Features

- **CVE detection** — cross-references imported packages against OSV, GitHub Advisory DB, and NVD
- **Pattern matching** — detects hardcoded secrets, MD5/SHA1, SQL injection, command injection, unsafe deserialization, and more
- **Language-aware** — TypeScript, JavaScript, Python, Go
- **Shareable reports** — public report links for sharing scan results
- **Daily CVE sync** — automated pipeline keeps vulnerability data fresh

---

## Stack

```
apps/
  web/                    → Next.js 16 (TypeScript) — Vercel
  analysis-engine/        → Go HTTP service — V2
  cli/                    → Go CLI binary
  zed-extension/          → Zed IDE extension + LSP server
packages/
  database/               → Drizzle ORM + Supabase
  types/                  → Shared TypeScript types
  ui/                     → Shared UI components
```

---

## CLI

Standalone binary — no server, no API key, no internet required.

### Install

**Linux:**
```bash
curl -L https://github.com/yuricommits/hwa/releases/download/v0.1.0/hwa-linux-amd64 -o hwa
chmod +x hwa
sudo mv hwa /usr/local/bin/
```

**macOS (Apple Silicon):**
```bash
curl -L https://github.com/yuricommits/hwa/releases/download/v0.1.0/hwa-darwin-arm64 -o hwa
chmod +x hwa
sudo mv hwa /usr/local/bin/
```

**macOS (Intel):**
```bash
curl -L https://github.com/yuricommits/hwa/releases/download/v0.1.0/hwa-darwin-amd64 -o hwa
chmod +x hwa
sudo mv hwa /usr/local/bin/
```

### Usage

```bash
# Scan a single file
hwa scan auth.ts

# Scan a directory
hwa scan src/

# JSON output
hwa scan . --json

# Version
hwa version
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | No critical findings |
| `1` | Critical findings found |

---

## CI/CD — GitHub Actions

Add to your repo to block PRs with critical vulnerabilities.

Create `.github/workflows/security.yml`:

```yaml
name: Security Scan

on:
  pull_request:
    branches: [main, master]

jobs:
  hwa:
    uses: yuricommits/hwa/.github/workflows/reusable-scan.yml@main
    with:
      fail_on_critical: true
```

### What it does

- Detects changed `.ts` `.js` `.py` `.go` files in the PR
- Downloads the `hwa` binary
- Scans for vulnerabilities
- Comments findings on the PR with file + line numbers
- Uploads JSON results as artifact
- Blocks merge if critical findings found

### Options

| Input | Default | Description |
|---|---|---|
| `fail_on_critical` | `true` | Block PR if critical findings exist |
| `scan_path` | changed files | Path to scan — leave empty for changed files only |

---

## Zed IDE Extension

Scans code as you type and shows inline diagnostics.

### Install

`Ctrl+Shift+P` → **"zed: install dev extension"** → select `apps/zed-extension`

### Configure

Add to your global Zed settings (`~/.config/zed/settings.json`):

```json
{
  "lsp": {
    "hwa-lsp": {
      "initialization_options": {
        "apiUrl": "https://hwa-kappa.vercel.app",
        "apiKey": "your-lsp-api-key"
      }
    }
  }
}
```

Get your `apiKey` from your hwa dashboard settings.

The project `.zed/settings.json` configures language server order — no credentials needed there.

---

## CVE Sources

| Source | Coverage | Schedule |
|---|---|---|
| [OSV](https://osv.dev) | Cross-ecosystem | Daily 2AM UTC |
| [GitHub Advisory DB](https://github.com/advisories) | npm-heavy, high quality | Daily 3AM UTC |
| [NVD](https://nvd.nist.gov) | Authoritative CVSS scores | Daily 4AM UTC |

---

## What it detects

| Category | Patterns |
|---|---|
| **Secrets** | Passwords, API keys, AWS keys, GitHub tokens, JWTs, OpenAI/Stripe keys |
| **Cryptography** | MD5, SHA1 |
| **Injection** | SQL injection, command injection (`shell=True`, `os.system`) |
| **Deserialization** | `pickle.load`, `yaml.load` without Loader |
| **SSL/TLS** | `verify=False`, `rejectUnauthorized: false` |
| **Randomness** | `Math.random()`, `random.random()` |
| **Code execution** | `eval()`, `exec()` |
| **Misc** | Flask debug mode |

---

## Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- Go 1.21+

### Setup

```bash
git clone https://github.com/yuricommits/hwa
cd hwa
pnpm install
cp .env.example .env
# Fill in Supabase credentials
pnpm dev
```

### Environment variables

```bash
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CRON_SECRET=
GITHUB_TOKEN=
NVD_API_KEY=
LSP_API_KEY=
```

### Commands

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Build all packages
pnpm check-types  # TypeScript type check
```

---

## Roadmap

```
V1 (current)
✅ Web dashboard
✅ CVE pipeline (OSV + GitHub + NVD)
✅ CLI tool
✅ Zed IDE extension
✅ GitHub Actions CI/CD

V2
⬜ Go analysis engine deployment
⬜ IDE plugin publishing (Zed registry)
⬜ CI/CD integration (GitLab, Bitbucket)
⬜ More language support (Ruby, Rust, Java)
```

---

## License

MIT
