# HWA GitHub Actions

## Quick setup — add to your repo

Create `.github/workflows/security.yml` in your project:
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

## Options

| Input | Default | Description |
|---|---|---|
| `fail_on_critical` | `true` | Block PR if critical findings exist |
| `scan_path` | changed files | Path to scan — leave empty to scan only changed files |

## What it does

1. Detects changed `.ts` `.js` `.py` `.go` files in the PR
2. Downloads the `hwa` binary
3. Scans for vulnerabilities
4. Comments findings on the PR
5. Uploads JSON results as artifact
6. Blocks merge if critical findings found
