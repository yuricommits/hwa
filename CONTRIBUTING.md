# Contributing to hwa

Thanks for your interest in contributing!

## Getting started

```bash
git clone https://github.com/yuricommits/hwa
cd hwa
pnpm install
cp .env.example .env
# Fill in Supabase credentials
pnpm dev
```

## How to contribute

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run type check: `pnpm check-types`
5. Open a PR against `main`

All PRs are automatically scanned by hwa itself. PRs with critical findings will be blocked.

## Areas to contribute

- New vulnerability patterns (`apps/web/lib/engine/staleness.ts`), `apps/cli/internal/scanner/patterns.go`)
- Additional language support (Ruby, Julia, Java)
- CVE source integrations
- CLI improvements (`apps/cli/`)
- IDE extension improvements (`apps/zed-extension/`)

## Suppressing false positives
Add `// hwa-ignore` or `# hwa-ignore` to any line to suppress hwa findings on that line or the line below it.

## Building the Zed extension
```bash
cd apps/zed-extension

# Build the WASM extension
cargo build --target wasm32-wasip1 --release

# Build the LSP server
cd lsp-server && cargo build --release
```

## Reporting vulnerabilities

Please do not open public issues for security vulnerabilities. Instead, use [GitHub private vulnerability reporting](https://github.com/yuricommits/hwa/security/advisories/new).

## Questions

Open an issue or start a discussion on GitHub.
