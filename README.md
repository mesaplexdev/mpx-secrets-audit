# mpx-secrets-audit 🔐

**Track, audit, and get warned before your API keys and secrets expire.**

Think "Fitbit for API keys" — it doesn't store secrets (that's Vault/Doppler), it tracks their age, expiry, and rotation status.

Part of the [Mesaplex](https://mesaplex.com) developer toolchain.

[![npm version](https://img.shields.io/npm/v/mpx-secrets-audit.svg)](https://www.npmjs.com/package/mpx-secrets-audit)
[![License: Dual](https://img.shields.io/badge/license-Dual-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

## Features

- **Secret lifecycle tracking** — Track age, expiry, and rotation status
- **Status dashboard** — Color-coded health overview of all secrets
- **Rotation policies** — Get warned when secrets are due for rotation
- **CI/CD ready** — Exit codes, JSON output, no GUI dependency
- **Multiple report formats** — Text, JSON, Markdown (JSON/Markdown Pro)
- **Cloud scanners** — Auto-detect AWS IAM keys and GitHub PATs (Pro)
- **MCP server** — Integrates with any MCP-compatible AI agent
- **Self-documenting** — `--schema` returns machine-readable tool description
- **No secrets stored** — Only metadata (names, dates, providers), never actual values

## Installation

```bash
npm install -g mpx-secrets-audit
```

Or run directly with npx:

```bash
npx mpx-secrets-audit init
```

**Requirements:** Node.js 18+ · No native dependencies · macOS, Linux, Windows

## Quick Start

```bash
# 1. Initialize config file
mpx-secrets-audit init

# 2. Add a secret to track
mpx-secrets-audit add stripe-api-key \
  --provider stripe \
  --type api_key \
  --created 2025-06-15 \
  --rotation 90

# 3. Check status
mpx-secrets-audit check

# 4. List all secrets
mpx-secrets-audit list

# 5. Generate report
mpx-secrets-audit report
```

## Usage

### Initialize

```bash
mpx-secrets-audit init              # Local config (.secrets-audit.json)
mpx-secrets-audit init --global     # Global config (~/.config/mpx-secrets-audit/)
```

### Add a Secret

```bash
# With flags
mpx-secrets-audit add github-token \
  --provider github \
  --type personal_access_token \
  --created 2025-01-15 \
  --expires 2026-01-15 \
  --rotation 90 \
  --notes "Production token with repo access"

# Interactive mode
mpx-secrets-audit add my-api-key --interactive
```

Options: `--provider`, `--type`, `--created`, `--expires`, `--rotation` (days), `--notes`, `--interactive`

### Check Status

```bash
mpx-secrets-audit check                        # Standard check
mpx-secrets-audit check --ci                   # CI mode (exit codes)
mpx-secrets-audit check --ci --fail-on warning # Fail on warnings
```

### List Secrets

```bash
mpx-secrets-audit list                    # List all
mpx-secrets-audit list --status warning   # Filter by status
mpx-secrets-audit list --status critical
```

### Rotate & Remove

```bash
mpx-secrets-audit rotate stripe-api-key   # Mark as rotated (updates date)
mpx-secrets-audit remove old-api-key      # Stop tracking
```

### Reports

```bash
mpx-secrets-audit report                              # Text report
mpx-secrets-audit report --format json                # JSON (Pro)
mpx-secrets-audit report --format markdown            # Markdown (Pro)
mpx-secrets-audit report --format markdown --output report.md
```

### Cloud Scanners (Pro)

```bash
# AWS IAM key discovery
mpx-secrets-audit scan-aws
mpx-secrets-audit scan-aws --auto-add

# GitHub PAT verification
GITHUB_TOKEN=ghp_xxx mpx-secrets-audit scan-github
GITHUB_TOKEN=ghp_xxx mpx-secrets-audit scan-github --auto-add
```

### Status Logic

| Status | Emoji | Criteria |
|--------|-------|----------|
| Healthy | 🟢 | Within rotation policy, not near expiry |
| Warning | 🟡 | >75% through rotation policy OR <30 days to expiry |
| Critical | 🔴 | Past rotation policy OR <7 days to expiry |
| Expired | ⛔ | Past expiry date |

## AI Agent Usage

mpx-secrets-audit is designed to be used by AI agents as well as humans.

### JSON Output

Add `--json` to any command for structured, machine-readable output:

```bash
mpx-secrets-audit check --json
```

```json
{
  "success": true,
  "total": 5,
  "summary": {
    "healthy": 3,
    "warning": 1,
    "critical": 1,
    "expired": 0
  },
  "secrets": { ... },
  "actionRequired": true
}
```

### Schema Discovery

```bash
mpx-secrets-audit --schema
```

Returns a complete JSON schema describing all commands, flags, inputs, outputs, and examples.

### MCP Integration

Add to your MCP client configuration (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "mpx-secrets-audit": {
      "command": "npx",
      "args": ["mpx-secrets-audit", "mcp"]
    }
  }
}
```

The MCP server exposes these tools:
- **`init`** — Create config file
- **`add_secret`** — Add secret to track
- **`list_secrets`** — List all secrets with status
- **`check_secrets`** — Run full audit
- **`remove_secret`** — Remove secret from tracking
- **`rotate_secret`** — Mark secret as rotated
- **`get_schema`** — Get full tool schema

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All secrets healthy |
| 1 | Warnings found (with `--fail-on warning`) |
| 2 | Critical or expired secrets found |

### Automation Tips

- Use `--json` for machine-parseable output
- Use `--quiet` to suppress banners and progress info
- Use `--ci` for automation-friendly exit codes
- Pipe output to `jq` for filtering

## CI/CD Integration

```yaml
# .github/workflows/secret-audit.yml
name: Secret Audit
on:
  schedule:
    - cron: '0 9 * * 1'
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npx mpx-secrets-audit check --ci --fail-on warning
```

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Secrets tracked | Up to 10 | Unlimited |
| Manual entry | ✅ | ✅ |
| Check and list commands | ✅ | ✅ |
| Text reports | ✅ | ✅ |
| CI/CD exit codes | ✅ | ✅ |
| MCP server | ✅ | ✅ |
| JSON/Markdown reports | ❌ | ✅ |
| AWS IAM scanner | ❌ | ✅ |
| GitHub PAT scanner | ❌ | ✅ |
| Team sharing | ❌ | ✅ |

**Upgrade to Pro:** Coming soon!

## Security Notes

- **No actual secret values are stored** — only metadata (names, dates, providers)
- Config files contain no credentials — just tracking information
- Safe to commit to version control (consider `.gitignore` for `.secrets-audit.json`)
- Cloud scanners never expose secret values, only metadata

## License

Dual License — Free tier for personal use, Pro license for commercial use and advanced features. See [LICENSE](LICENSE) for full terms.

## Links

- **Website:** [https://mesaplex.com](https://mesaplex.com)
- **npm:** [https://www.npmjs.com/package/mpx-secrets-audit](https://www.npmjs.com/package/mpx-secrets-audit)
- **GitHub:** [https://github.com/mesaplexdev/mpx-secrets-audit](https://github.com/mesaplexdev/mpx-secrets-audit)
- **Support:** support@mesaplex.com

### Related Tools

- **[mpx-scan](https://www.npmjs.com/package/mpx-scan)** — Website security scanner
- **[mpx-api](https://www.npmjs.com/package/mpx-api)** — API testing, mocking, and documentation
- **[mpx-db](https://www.npmjs.com/package/mpx-db)** — Database management CLI

---

**Made with ❤️ by [Mesaplex](https://mesaplex.com)**
