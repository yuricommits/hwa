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

- New vulnerability patterns (`apps/web/lib/engine/staleness.ts`)
- Additional language support (Ruby, Rust, Java)
- CVE source integrations
- CLI improvements (`apps/cli/`)
- IDE extension improvements (`apps/zed-extension/`)

## Reporting vulnerabilities

Please do not open public issues for security vulnerabilities. Email directly instead.

## Questions

Open an issue or start a discussion on GitHub.
