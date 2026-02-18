#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

import {
  initConfig,
  configExists,
  loadConfig,
  addSecret,
  removeSecret,
  listSecrets,
  checkSecrets,
  rotateSecret,
  getStatusEmoji,
  getStatusMessage,
  calculateAge,
  daysUntilExpiry,
  generateTextReport,
  generateJsonReport,
  generateMarkdownReport,
  getSchema,
  startMCPServer,
  awsScanner,
  githubScanner
} from '../lib/index.js';

// Handle --schema flag before Commander parses
if (process.argv.includes('--schema')) {
  console.log(JSON.stringify(getSchema(), null, 2));
  process.exit(0);
}

const program = new Command();

program
  .name('mpx-secrets-audit')
  .description('Never get caught with expired API keys again — track, audit, and get warned before your secrets expire.')
  .version(pkg.version)
  .option('--json', 'Output as JSON (machine-readable)')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('--no-color', 'Disable colored output')
  .option('--schema', 'Output JSON schema describing all commands and flags');

// Handle --no-color
if (process.argv.includes('--no-color') || !process.stdout.isTTY) {
  chalk.level = 0;
}

// Propagate global --json and --quiet to subcommands
program.hook('preAction', (thisCommand) => {
  const parentOpts = thisCommand.parent?.opts() || {};
  const opts = thisCommand.opts();
  // Global --json and --quiet flow down to subcommands
  if (parentOpts.json && !opts.json) {
    thisCommand.setOptionValue('json', true);
  }
  if (parentOpts.quiet && !opts.quiet) {
    thisCommand.setOptionValue('quiet', true);
  }
});

// Helper function for interactive prompts
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Init command
program
  .command('init')
  .description('Create a new secrets audit config file')
  .option('-g, --global', 'Create config in global location (~/.config/mpx-secrets-audit/)')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action(async (options) => {
    try {
      const configPath = initConfig(options.global);
      
      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          configPath,
          message: 'Config file created'
        }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green('✓ Config file created at:'), configPath);
        console.log(chalk.cyan('\nNext steps:'));
        console.log('  1. Add a secret: mpx-secrets-audit add <name>');
        console.log('  2. Check status: mpx-secrets-audit check');
      } else {
        console.log(configPath);
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_INIT'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Add command
program
  .command('add <name>')
  .description('Add a new secret to track')
  .option('-p, --provider <provider>', 'Service provider (e.g., stripe, aws, github)')
  .option('-t, --type <type>', 'Secret type (api_key, token, password)', 'api_key')
  .option('-c, --created <date>', 'Creation date (YYYY-MM-DD)')
  .option('-e, --expires <date>', 'Expiry date (YYYY-MM-DD)')
  .option('-r, --rotation <days>', 'Rotation policy in days', '90')
  .option('-n, --notes <notes>', 'Additional notes')
  .option('-i, --interactive', 'Interactive mode (prompts for all fields)')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action(async (name, options) => {
    try {
      if (!configExists()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No config file found. Run "mpx-secrets-audit init" first.',
            code: 'ERR_NO_CONFIG'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        }
        process.exit(1);
      }

      let secretData = { name };

      if (options.interactive && !options.json) {
        secretData.provider = await prompt('Provider (e.g., stripe, aws, github): ');
        secretData.type = await prompt('Type (api_key, token, password) [api_key]: ') || 'api_key';
        secretData.createdAt = await prompt('Created date (YYYY-MM-DD) [today]: ') || undefined;
        const expires = await prompt('Expires date (YYYY-MM-DD) [none]: ');
        secretData.expiresAt = expires || null;
        const rotation = await prompt('Rotation policy in days [90]: ');
        secretData.rotationPolicy = rotation ? parseInt(rotation, 10) : 90;
        secretData.notes = await prompt('Notes [optional]: ') || '';
      } else {
        secretData.provider = options.provider;
        secretData.type = options.type;
        secretData.createdAt = options.created;
        secretData.expiresAt = options.expires || null;
        secretData.rotationPolicy = parseInt(options.rotation, 10);
        secretData.notes = options.notes || '';
      }

      const secret = addSecret(secretData);
      
      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          secret: {
            ...secret,
            age: calculateAge(secret),
            daysUntilExpiry: daysUntilExpiry(secret),
            message: getStatusMessage(secret)
          }
        }, null, 2));
      } else if (options.quiet) {
        console.log(secret.name);
      } else {
        const emoji = getStatusEmoji(secret.status);
        console.log(chalk.green('✓ Secret added:'), secret.name);
        console.log(`  Status: ${emoji} ${secret.status}`);
        console.log(`  Provider: ${secret.provider}`);
        console.log(`  Rotation Policy: ${secret.rotationPolicy} days`);
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_ADD'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all tracked secrets')
  .option('-s, --status <status>', 'Filter by status (healthy, warning, critical, expired)')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action((options) => {
    try {
      if (!configExists()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No config file found. Run "mpx-secrets-audit init" first.',
            code: 'ERR_NO_CONFIG'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        }
        process.exit(1);
      }

      let secrets = listSecrets();

      if (options.status) {
        secrets = secrets.filter(s => s.status === options.status);
      }

      if (options.json) {
        const enrichedSecrets = secrets.map(secret => ({
          ...secret,
          age: calculateAge(secret),
          daysUntilExpiry: daysUntilExpiry(secret),
          message: getStatusMessage(secret)
        }));
        console.log(JSON.stringify({
          success: true,
          count: enrichedSecrets.length,
          secrets: enrichedSecrets
        }, null, 2));
        return;
      }

      if (secrets.length === 0) {
        if (!options.quiet) {
          console.log(chalk.yellow('No secrets tracked yet.'));
          console.log('Add a secret with: mpx-secrets-audit add <name>');
        }
        return;
      }

      if (!options.quiet) {
        console.log(chalk.bold(`\n${secrets.length} secret${secrets.length === 1 ? '' : 's'} tracked:\n`));
      }

      secrets.forEach(secret => {
        const emoji = getStatusEmoji(secret.status);
        const age = calculateAge(secret);
        const expiry = daysUntilExpiry(secret);
        const message = getStatusMessage(secret);

        if (options.quiet) {
          console.log(secret.name);
        } else {
          console.log(`${emoji} ${chalk.bold(secret.name)}`);
          console.log(`   Provider: ${secret.provider} | Type: ${secret.type}`);
          console.log(`   Status: ${chalk[secret.status === 'healthy' ? 'green' : secret.status === 'warning' ? 'yellow' : 'red'](secret.status.toUpperCase())} - ${message}`);
          
          if (age !== null) {
            console.log(`   Age: ${age} day${age === 1 ? '' : 's'}`);
          }
          
          if (secret.notes) {
            console.log(`   Notes: ${secret.notes}`);
          }
          
          console.log('');
        }
      });
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_LIST'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Check command
program
  .command('check')
  .description('Run audit and check for expiring/old secrets')
  .option('--ci', 'CI mode: exit with code 1 for warnings, 2 for critical/expired (default --fail-on warning)')
  .option('--fail-on <level>', 'Fail on this level or higher (warning, critical, expired)')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action((options) => {
    try {
      if (!configExists()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No config file found. Run "mpx-secrets-audit init" first.',
            code: 'ERR_NO_CONFIG'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        }
        process.exit(1);
      }

      const results = checkSecrets();
      const total = results.healthy.length + results.warning.length + results.critical.length + results.expired.length;

      // Enrich secrets with additional info
      const enrichResults = {};
      for (const [status, secrets] of Object.entries(results)) {
        enrichResults[status] = secrets.map(s => ({
          ...s,
          age: calculateAge(s),
          daysUntilExpiry: daysUntilExpiry(s),
          message: getStatusMessage(s)
        }));
      }

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          total,
          summary: {
            healthy: results.healthy.length,
            warning: results.warning.length,
            critical: results.critical.length,
            expired: results.expired.length
          },
          secrets: enrichResults,
          actionRequired: results.critical.length > 0 || results.expired.length > 0
        }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.bold('\n🔍 Secrets Audit Results\n'));
        console.log(`Total secrets: ${total}`);
        console.log(chalk.green(`🟢 Healthy: ${results.healthy.length}`));
        console.log(chalk.yellow(`🟡 Warning: ${results.warning.length}`));
        console.log(chalk.red(`🔴 Critical: ${results.critical.length}`));
        console.log(chalk.red(`⛔ Expired: ${results.expired.length}`));
        console.log('');

        // Show issues
        if (results.expired.length > 0) {
          console.log(chalk.red.bold('⛔ EXPIRED SECRETS:'));
          results.expired.forEach(s => {
            console.log(chalk.red(`  • ${s.name}: ${getStatusMessage(s)}`));
          });
          console.log('');
        }

        if (results.critical.length > 0) {
          console.log(chalk.red.bold('🔴 CRITICAL:'));
          results.critical.forEach(s => {
            console.log(chalk.red(`  • ${s.name}: ${getStatusMessage(s)}`));
          });
          console.log('');
        }

        if (results.warning.length > 0) {
          console.log(chalk.yellow.bold('🟡 WARNINGS:'));
          results.warning.forEach(s => {
            console.log(chalk.yellow(`  • ${s.name}: ${getStatusMessage(s)}`));
          });
          console.log('');
        }

        if (results.expired.length > 0 || results.critical.length > 0) {
          console.log(chalk.red('⚠️  Action required! Rotate or renew these secrets.'));
        } else if (results.warning.length > 0) {
          console.log(chalk.yellow('⚠️  Some secrets need attention soon.'));
        } else {
          console.log(chalk.green('✓ All secrets are healthy!'));
        }
      }

      // CI mode exit codes
      if (options.ci) {
        const failLevel = options.failOn || 'warning';
        
        if (results.expired.length > 0 && ['expired', 'critical', 'warning'].includes(failLevel)) {
          process.exit(2);
        }
        
        if (results.critical.length > 0 && ['critical', 'warning'].includes(failLevel)) {
          process.exit(2);
        }
        
        if (results.warning.length > 0 && failLevel === 'warning') {
          process.exit(1);
        }
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_CHECK'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Remove command
program
  .command('remove <name>')
  .description('Stop tracking a secret')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action((name, options) => {
    try {
      if (!configExists()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No config file found.',
            code: 'ERR_NO_CONFIG'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'No config file found.');
        }
        process.exit(1);
      }

      const removed = removeSecret(name);
      
      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          removed,
          message: `Secret "${name}" removed`
        }, null, 2));
      } else if (options.quiet) {
        console.log(name);
      } else {
        console.log(chalk.green('✓ Secret removed:'), name);
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_REMOVE'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Rotate command
program
  .command('rotate <name>')
  .description('Mark a secret as rotated (updates last-rotated date)')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action((name, options) => {
    try {
      if (!configExists()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No config file found.',
            code: 'ERR_NO_CONFIG'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'No config file found.');
        }
        process.exit(1);
      }

      const secret = rotateSecret(name);
      
      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          secret: {
            ...secret,
            age: calculateAge(secret),
            daysUntilExpiry: daysUntilExpiry(secret),
            message: getStatusMessage(secret)
          },
          message: `Secret "${name}" rotated`
        }, null, 2));
      } else if (options.quiet) {
        console.log(name);
      } else {
        const emoji = getStatusEmoji(secret.status);
        console.log(chalk.green('✓ Secret rotated:'), secret.name);
        console.log(`  New status: ${emoji} ${secret.status}`);
        console.log(`  Last rotated: ${secret.lastRotated}`);
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_ROTATE'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate audit report')
  .option('-f, --format <format>', 'Report format (text, json, markdown)', 'text')
  .option('--json', 'Output as JSON (shorthand for --format json)')
  .option('-o, --output <file>', 'Output file (defaults to stdout)')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action(async (options) => {
    // --json flag overrides --format
    if (options.json) {
      options.format = 'json';
    }
    try {
      if (!configExists()) {
        const errorMsg = 'No config file found.';
        if (options.format === 'json') {
          console.log(JSON.stringify({
            success: false,
            error: errorMsg,
            code: 'ERR_NO_CONFIG'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), errorMsg);
        }
        process.exit(1);
      }

      const config = loadConfig();
      
      if (config.tier === 'free' && options.format !== 'text') {
        const errorMsg = 'JSON and Markdown reports are Pro features. Upgrade to use this feature.';
        if (options.format === 'json') {
          console.log(JSON.stringify({
            success: false,
            error: errorMsg,
            code: 'ERR_PRO_REQUIRED'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), errorMsg);
        }
        process.exit(1);
      }

      const secrets = listSecrets();
      let report;

      switch (options.format) {
        case 'json':
          report = generateJsonReport(secrets);
          break;
        case 'markdown':
          report = generateMarkdownReport(secrets);
          break;
        case 'text':
        default:
          report = generateTextReport(secrets);
      }

      if (options.output) {
        const { writeFileSync } = await import('fs');
        writeFileSync(options.output, report, 'utf8');
        if (!options.quiet) {
          console.log(chalk.green('✓ Report saved to:'), options.output);
        }
      } else {
        console.log(report);
      }
    } catch (error) {
      if (options.format === 'json') {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_REPORT'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// AWS Scanner
program
  .command('scan-aws')
  .description('Scan AWS IAM for access keys (Pro feature)')
  .option('--auto-add', 'Automatically add discovered keys to tracking')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action(async (options) => {
    try {
      if (!configExists()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No config file found. Run "mpx-secrets-audit init" first.',
            code: 'ERR_NO_CONFIG'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        }
        process.exit(1);
      }

      const config = loadConfig();
      
      if (config.tier === 'free') {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'AWS scanning is a Pro feature. Upgrade to use this feature.',
            code: 'ERR_PRO_REQUIRED'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'AWS scanning is a Pro feature. Upgrade to use this feature.');
          console.log(chalk.cyan('\nPro features include:'));
          console.log('  • Unlimited secrets');
          console.log('  • AWS IAM scanner');
          console.log('  • GitHub PAT scanner');
          console.log('  • JSON/Markdown reports');
          console.log('  • CI/CD integration');
        }
        process.exit(1);
      }

      if (!awsScanner.isAvailable()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'AWS SDK not installed.',
            code: 'ERR_MISSING_DEPENDENCY',
            suggestion: 'npm install @aws-sdk/client-iam'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'AWS SDK not installed.');
          console.log('Install with: npm install @aws-sdk/client-iam');
        }
        process.exit(1);
      }

      if (!options.quiet && !options.json) {
        console.log(chalk.cyan('Scanning AWS IAM access keys...'));
      }
      
      const keys = await awsScanner.scanAwsKeys();
      
      if (options.json) {
        const result = { success: true, count: keys.length, keys };
        
        if (options.autoAdd) {
          const secrets = awsScanner.convertToSecrets(keys);
          let added = 0;
          const errors = [];
          
          for (const secret of secrets) {
            try {
              addSecret(secret);
              added++;
            } catch (error) {
              if (!error.message.includes('already exists')) {
                errors.push({ name: secret.name, error: error.message });
              }
            }
          }
          
          result.autoAdd = { added, errors };
        }
        
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (keys.length === 0) {
          console.log(chalk.yellow('No AWS access keys found.'));
          return;
        }

        if (!options.quiet) {
          console.log(chalk.green(`\n✓ Found ${keys.length} AWS access key${keys.length === 1 ? '' : 's'}:\n`));
        }

        keys.forEach(key => {
          const ageWarning = key.age > 90 ? chalk.red(' ⚠️  OLD') : '';
          console.log(`  • ****${key.keyId}`);
          console.log(`    Status: ${key.status}`);
          console.log(`    Created: ${key.createdAt} (${key.age} days ago)${ageWarning}`);
          console.log(`    Last used: ${key.lastUsed}`);
          console.log('');
        });

        if (options.autoAdd) {
          const secrets = awsScanner.convertToSecrets(keys);
          let added = 0;
          
          for (const secret of secrets) {
            try {
              addSecret(secret);
              added++;
            } catch (error) {
              if (!error.message.includes('already exists')) {
                console.error(chalk.yellow(`  Warning: Could not add ${secret.name}: ${error.message}`));
              }
            }
          }
          
          console.log(chalk.green(`✓ Added ${added} new secret${added === 1 ? '' : 's'} to tracking`));
        } else if (!options.quiet) {
          console.log(chalk.cyan('Use --auto-add to automatically track these keys'));
        }
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_AWS_SCAN'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// GitHub Scanner
program
  .command('scan-github')
  .description('Scan GitHub for Personal Access Tokens (Pro feature)')
  .option('--auto-add', 'Automatically add discovered tokens to tracking')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action(async (options) => {
    try {
      if (!configExists()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No config file found. Run "mpx-secrets-audit init" first.',
            code: 'ERR_NO_CONFIG'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        }
        process.exit(1);
      }

      const config = loadConfig();
      
      if (config.tier === 'free') {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'GitHub scanning is a Pro feature. Upgrade to use this feature.',
            code: 'ERR_PRO_REQUIRED'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'GitHub scanning is a Pro feature. Upgrade to use this feature.');
        }
        process.exit(1);
      }

      if (!githubScanner.isAvailable()) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'Octokit not installed.',
            code: 'ERR_MISSING_DEPENDENCY',
            suggestion: 'npm install @octokit/rest'
          }, null, 2));
        } else {
          console.error(chalk.red('Error:'), 'Octokit not installed.');
          console.log('Install with: npm install @octokit/rest');
        }
        process.exit(1);
      }

      if (!options.quiet && !options.json) {
        console.log(chalk.cyan('Scanning GitHub tokens...'));
      }
      
      const tokens = await githubScanner.scanGitHubTokens();
      
      if (options.json) {
        const result = { success: true, count: tokens.length, tokens };
        
        if (options.autoAdd) {
          const secrets = githubScanner.convertToSecrets(tokens);
          let added = 0;
          const errors = [];
          
          for (const secret of secrets) {
            try {
              addSecret(secret);
              added++;
            } catch (error) {
              if (!error.message.includes('already exists')) {
                errors.push({ name: secret.name, error: error.message });
              }
            }
          }
          
          result.autoAdd = { added, errors };
          result.note = 'GitHub API does not expose token expiry dates. Set expiry date manually if known.';
        }
        
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (!options.quiet) {
          console.log(chalk.green(`\n✓ GitHub token verified\n`));
        }

        tokens.forEach(token => {
          console.log(`  • ${token.name}`);
          console.log(`    ${token.note}`);
          console.log('');
        });

        if (options.autoAdd) {
          const secrets = githubScanner.convertToSecrets(tokens);
          let added = 0;
          
          for (const secret of secrets) {
            try {
              addSecret(secret);
              added++;
            } catch (error) {
              if (!error.message.includes('already exists')) {
                console.error(chalk.yellow(`  Warning: Could not add ${secret.name}: ${error.message}`));
              }
            }
          }
          
          console.log(chalk.green(`✓ Added ${added} new secret${added === 1 ? '' : 's'} to tracking`));
          console.log(chalk.yellow('\n⚠️  Note: GitHub API does not expose token expiry dates.'));
          console.log(chalk.yellow('    You must manually set the expiry date if known.'));
        } else if (!options.quiet) {
          console.log(chalk.cyan('Use --auto-add to automatically track this token'));
        }
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          code: 'ERR_GITHUB_SCAN'
        }, null, 2));
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Update subcommand
program
  .command('update')
  .description('Check for updates and optionally install the latest version')
  .option('--check', 'Only check for updates (do not install)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { checkForUpdate, performUpdate } = await import('../lib/update.js');
    const jsonMode = options.json;

    try {
      const info = checkForUpdate();

      if (jsonMode) {
        const output = {
          current: info.current,
          latest: info.latest,
          updateAvailable: info.updateAvailable,
          isGlobal: info.isGlobal
        };

        if (!options.check && info.updateAvailable) {
          try {
            const result = performUpdate(info.isGlobal);
            output.updated = true;
            output.newVersion = result.version;
          } catch (err) {
            output.updated = false;
            output.error = err.message;
          }
        }

        console.log(JSON.stringify(output, null, 2));
        process.exit(0);
        return;
      }

      // Human-readable output
      if (!info.updateAvailable) {
        console.log('');
        console.log(chalk.green.bold(`✓ mpx-secrets-audit v${info.current} is up to date`));
        console.log('');
        process.exit(0);
        return;
      }

      console.log('');
      console.log(chalk.yellow.bold(`⬆ Update available: v${info.current} → v${info.latest}`));

      if (options.check) {
        console.log(chalk.gray(`Run ${chalk.cyan('mpx-secrets-audit update')} to install`));
        console.log('');
        process.exit(0);
        return;
      }

      console.log(chalk.gray(`Installing v${info.latest}${info.isGlobal ? ' (global)' : ''}...`));

      const result = performUpdate(info.isGlobal);
      console.log(chalk.green.bold(`✓ Updated to v${result.version}`));
      console.log('');
      process.exit(0);
    } catch (err) {
      if (jsonMode) {
        console.log(JSON.stringify({ error: err.message, code: 'ERR_UPDATE' }, null, 2));
      } else {
        console.error(chalk.red.bold('\n❌ Update check failed:'), err.message);
        console.error('');
      }
      process.exit(1);
    }
  });

// MCP subcommand
program
  .command('mcp')
  .description('Start MCP (Model Context Protocol) stdio server for AI agent integration')
  .action(async () => {
    try {
      await startMCPServer();
    } catch (err) {
      console.error(JSON.stringify({ 
        error: err.message, 
        code: 'ERR_MCP_START' 
      }));
      process.exit(1);
    }
  });

program.parse();
