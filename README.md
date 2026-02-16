# mpx-secrets-audit

> **Never get caught with expired API keys again** — track, audit, and get warned before your secrets expire.

`mpx-secrets-audit` is a CLI tool that tracks the lifecycle of API keys, tokens, and credentials across services. Think "Fitbit for API keys" — it doesn't STORE secrets (that's Vault/Doppler), it TRACKS their age, expiry, and rotation status.

## The Problem

- API keys expire without warning
- Credentials get forgotten and never rotated
- Production outages from expired secrets
- No centralized view of secret health across services
- Compliance requirements for regular rotation

## The Solution

`mpx-secrets-audit` tracks metadata about your secrets (NOT the actual values) and alerts you when:
- Keys are approaching expiry
- Rotation policies are past due
- Secrets are too old and need refresh

Perfect for:
- DevOps teams managing multiple API keys
- CI/CD pipelines that need secret rotation checks
- Security compliance reporting
- Personal projects with scattered credentials

## Installation

### Global Install
```bash
npm install -g mpx-secrets-audit
```

### One-off Usage with npx
```bash
npx mpx-secrets-audit init
npx mpx-secrets-audit add my-api-key
```

### Local Project Install
```bash
npm install --save-dev mpx-secrets-audit
```

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

## Commands

### `init`
Create a new secrets audit config file.

```bash
# Local config (.secrets-audit.json in current directory)
mpx-secrets-audit init

# Global config (~/.config/mpx-secrets-audit/config.json)
mpx-secrets-audit init --global
```

### `add <name>`
Add a new secret to track.

```bash
# Interactive mode (prompts for all fields)
mpx-secrets-audit add my-api-key --interactive

# Command-line flags
mpx-secrets-audit add github-token \
  --provider github \
  --type personal_access_token \
  --created 2025-01-15 \
  --expires 2026-01-15 \
  --rotation 90 \
  --notes "Production token with repo access"
```

**Options:**
- `-p, --provider <provider>` - Service provider (e.g., stripe, aws, github)
- `-t, --type <type>` - Secret type (api_key, token, password)
- `-c, --created <date>` - Creation date (YYYY-MM-DD)
- `-e, --expires <date>` - Expiry date (YYYY-MM-DD)
- `-r, --rotation <days>` - Rotation policy in days (default: 90)
- `-n, --notes <notes>` - Additional notes
- `-i, --interactive` - Interactive mode

### `list`
List all tracked secrets.

```bash
# List all
mpx-secrets-audit list

# Filter by status
mpx-secrets-audit list --status warning
mpx-secrets-audit list --status critical
```

**Output:**
```
🟢 stripe-api-key
   Provider: stripe | Type: api_key
   Status: HEALTHY - Healthy
   Age: 15 days
   
🟡 aws-access-key
   Provider: aws | Type: access_key
   Status: WARNING - 20 days until rotation due
   Age: 70 days
```

### `check`
Run audit and check for expiring/old secrets.

```bash
# Standard check
mpx-secrets-audit check

# CI/CD mode (exit codes for automation)
mpx-secrets-audit check --ci

# Fail on warnings (default: fail on critical)
mpx-secrets-audit check --ci --fail-on warning
```

**Exit Codes:**
- `0` - All secrets healthy
- `1` - Warnings found
- `2` - Critical or expired secrets found

**Example Output:**
```
🔍 Secrets Audit Results

Total secrets: 5
🟢 Healthy: 3
🟡 Warning: 1
🔴 Critical: 1
⛔ Expired: 0

🔴 CRITICAL:
  • aws-key-1234: Past rotation policy by 15 days

🟡 WARNINGS:
  • github-token: 25 days until rotation due

⚠️  Action required! Rotate or renew these secrets.
```

### `remove <name>`
Stop tracking a secret.

```bash
mpx-secrets-audit remove old-api-key
```

### `rotate <name>`
Mark a secret as rotated (updates last-rotated date to today).

```bash
mpx-secrets-audit rotate stripe-api-key
```

### `report`
Generate audit report in various formats.

```bash
# Text report (stdout)
mpx-secrets-audit report

# JSON report
mpx-secrets-audit report --format json

# Markdown report
mpx-secrets-audit report --format markdown

# Save to file
mpx-secrets-audit report --format markdown --output audit-report.md
```

### `scan-aws` (Pro)
Auto-detect AWS IAM access keys.

```bash
# List discovered keys
mpx-secrets-audit scan-aws

# Automatically add to tracking
mpx-secrets-audit scan-aws --auto-add
```

**Requirements:**
- AWS credentials configured (`~/.aws/credentials` or env vars)
- `@aws-sdk/client-iam` package installed
- Pro tier

### `scan-github` (Pro)
Verify GitHub Personal Access Token.

```bash
# Check current token
GITHUB_TOKEN=ghp_xxx mpx-secrets-audit scan-github

# Add to tracking
GITHUB_TOKEN=ghp_xxx mpx-secrets-audit scan-github --auto-add
```

**Requirements:**
- `GITHUB_TOKEN` environment variable
- `@octokit/rest` package installed
- Pro tier

## Configuration

Config file location (searched in order):
1. `.secrets-audit.json` (local, current directory)
2. `~/.config/mpx-secrets-audit/config.json` (global)

**Example config:**
```json
{
  "version": "1.0.0",
  "tier": "free",
  "secrets": [
    {
      "name": "stripe-api-key",
      "provider": "stripe",
      "type": "api_key",
      "createdAt": "2025-06-15",
      "expiresAt": null,
      "lastRotated": "2025-06-15",
      "rotationPolicy": 90,
      "status": "healthy",
      "notes": "Production key"
    }
  ]
}
```

**Fields:**
- `name` - Unique identifier for the secret
- `provider` - Service provider (stripe, aws, github, etc.)
- `type` - Secret type (api_key, token, password, etc.)
- `createdAt` - Creation date (YYYY-MM-DD)
- `expiresAt` - Expiry date (YYYY-MM-DD) or `null`
- `lastRotated` - Last rotation date (YYYY-MM-DD)
- `rotationPolicy` - Days between rotations
- `status` - Calculated status (healthy, warning, critical, expired)
- `notes` - Optional notes

## Status Logic

Secrets are automatically categorized based on age and expiry:

| Status | Emoji | Criteria |
|--------|-------|----------|
| **Healthy** | 🟢 | Within rotation policy, not near expiry |
| **Warning** | 🟡 | >75% through rotation policy OR <30 days to expiry |
| **Critical** | 🔴 | Past rotation policy OR <7 days to expiry |
| **Expired** | ⛔ | Past expiry date |

## CI/CD Integration

### GitHub Actions

```yaml
name: Secret Audit

on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9 AM
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install mpx-secrets-audit
        run: npm install -g mpx-secrets-audit
      
      - name: Run audit
        run: mpx-secrets-audit check --ci --fail-on warning
      
      - name: Generate report
        if: failure()
        run: mpx-secrets-audit report --format markdown > audit-report.md
      
      - name: Upload report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: audit-report.md
```

### GitLab CI

```yaml
secret-audit:
  image: node:18
  script:
    - npm install -g mpx-secrets-audit
    - mpx-secrets-audit check --ci --fail-on warning
  only:
    - schedules
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

npx mpx-secrets-audit check --ci --fail-on critical
if [ $? -ne 0 ]; then
  echo "❌ Secret audit failed! Critical secrets need rotation."
  exit 1
fi
```

## AWS IAM Scanner Setup

### Install AWS SDK
```bash
npm install -g @aws-sdk/client-iam
```

### Configure AWS Credentials
```bash
# Option 1: AWS CLI
aws configure

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_REGION=us-east-1

# Option 3: ~/.aws/credentials file
[default]
aws_access_key_id = xxx
aws_secret_access_key = xxx
```

### Run Scanner
```bash
mpx-secrets-audit scan-aws --auto-add
```

## GitHub Scanner Setup

### Install Octokit
```bash
npm install -g @octokit/rest
```

### Set GitHub Token
```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### Run Scanner
```bash
mpx-secrets-audit scan-github --auto-add
```

## Free vs Pro

| Feature | Free | Pro ($12/mo) |
|---------|------|--------------|
| **Secrets tracked** | Up to 10 | Unlimited |
| **Manual entry** | ✅ | ✅ |
| **`check` and `list` commands** | ✅ | ✅ |
| **Text reports** | ✅ | ✅ |
| **JSON/Markdown reports** | ❌ | ✅ |
| **AWS IAM scanner** | ❌ | ✅ |
| **GitHub PAT scanner** | ❌ | ✅ |
| **CI/CD exit codes** | ✅ | ✅ |
| **Team sharing** | ❌ | ✅ |
| **Future scanners** (GCP, Azure, Stripe) | ❌ | ✅ |

**Upgrade to Pro:** Coming soon!

## Troubleshooting

### "No config file found"
Run `mpx-secrets-audit init` to create a config file first.

### "AWS SDK not installed"
Install the AWS SDK: `npm install @aws-sdk/client-iam`

### "AWS credentials not configured"
Set up your AWS credentials:
```bash
aws configure
# OR
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
```

### "GITHUB_TOKEN environment variable not set"
Export your GitHub token:
```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### "Free tier limit reached"
You've tracked 10 secrets (the free tier limit). Upgrade to Pro for unlimited secrets, or remove old secrets with `mpx-secrets-audit remove <name>`.

### Config file location
Local (`.secrets-audit.json`) takes precedence over global (`~/.config/mpx-secrets-audit/config.json`).

## Security Notes

- **No actual secret values are stored** — only metadata (names, dates, providers)
- Config files contain NO credentials — just tracking information
- Safe to commit to version control (but consider `.gitignore` for `.secrets-audit.json`)
- AWS and GitHub scanners never expose secret values, only metadata

## Examples

### Track Stripe API Key
```bash
mpx-secrets-audit add stripe-prod-key \
  --provider stripe \
  --type api_key \
  --created 2025-01-01 \
  --rotation 90 \
  --notes "Production Stripe secret key"
```

### Track GitHub PAT with Expiry
```bash
mpx-secrets-audit add github-actions-token \
  --provider github \
  --type personal_access_token \
  --created 2025-06-01 \
  --expires 2026-06-01 \
  --rotation 365 \
  --notes "GitHub Actions deployment token"
```

### Weekly Audit Script
```bash
#!/bin/bash
# weekly-audit.sh

echo "🔍 Running weekly secrets audit..."
mpx-secrets-audit check

if [ $? -ne 0 ]; then
  echo "⚠️  Action required!"
  mpx-secrets-audit report --format markdown --output weekly-report.md
  # Send alert (email, Slack, etc.)
fi
```

## Contributing

Found a bug? Want a new scanner?

- **Issues:** https://github.com/mesaplexdev/mpx-secrets-audit/issues
- **Pull requests:** Welcome!

## License

MIT License - see [LICENSE](LICENSE)

## Author

**Mesaplex** <support@mesaplex.com>

Part of the [Mesaplex CLI Tools](https://github.com/mesaplexdev) suite.

---

**Related Tools:**
- [`mpx-scan`](https://github.com/mesaplexdev/mpx-scan) - Smart file/directory scanning
- [`mpx-api`](https://github.com/mesaplexdev/mpx-api) - REST API scaffolding
- [`mpx-db`](https://github.com/mesaplexdev/mpx-db) - Database migration tool
