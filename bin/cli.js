#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
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
  awsScanner,
  githubScanner
} from '../lib/index.js';

const program = new Command();

program
  .name('mpx-secrets-audit')
  .description('Never get caught with expired API keys again — track, audit, and get warned before your secrets expire.')
  .version('1.0.0');

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
  .action(async (options) => {
    try {
      const configPath = initConfig(options.global);
      console.log(chalk.green('✓ Config file created at:'), configPath);
      console.log(chalk.cyan('\nNext steps:'));
      console.log('  1. Add a secret: mpx-secrets-audit add <name>');
      console.log('  2. Check status: mpx-secrets-audit check');
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
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
  .action(async (name, options) => {
    try {
      if (!configExists()) {
        console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        process.exit(1);
      }

      let secretData = { name };

      if (options.interactive) {
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
      const emoji = getStatusEmoji(secret.status);
      
      console.log(chalk.green('✓ Secret added:'), secret.name);
      console.log(`  Status: ${emoji} ${secret.status}`);
      console.log(`  Provider: ${secret.provider}`);
      console.log(`  Rotation Policy: ${secret.rotationPolicy} days`);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all tracked secrets')
  .option('-s, --status <status>', 'Filter by status (healthy, warning, critical, expired)')
  .action((options) => {
    try {
      if (!configExists()) {
        console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        process.exit(1);
      }

      let secrets = listSecrets();

      if (options.status) {
        secrets = secrets.filter(s => s.status === options.status);
      }

      if (secrets.length === 0) {
        console.log(chalk.yellow('No secrets tracked yet.'));
        console.log('Add a secret with: mpx-secrets-audit add <name>');
        return;
      }

      console.log(chalk.bold(`\n${secrets.length} secret${secrets.length === 1 ? '' : 's'} tracked:\n`));

      secrets.forEach(secret => {
        const emoji = getStatusEmoji(secret.status);
        const age = calculateAge(secret);
        const expiry = daysUntilExpiry(secret);
        const message = getStatusMessage(secret);

        console.log(`${emoji} ${chalk.bold(secret.name)}`);
        console.log(`   Provider: ${secret.provider} | Type: ${secret.type}`);
        console.log(`   Status: ${chalk[secret.status === 'healthy' ? 'green' : secret.status === 'warning' ? 'yellow' : 'red'](secret.status.toUpperCase())} - ${message}`);
        
        if (age !== null) {
          console.log(`   Age: ${age} days`);
        }
        
        if (secret.notes) {
          console.log(`   Notes: ${secret.notes}`);
        }
        
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Check command
program
  .command('check')
  .description('Run audit and check for expiring/old secrets')
  .option('--ci', 'CI mode: exit with code 1 for warnings, 2 for critical/expired')
  .option('--fail-on <level>', 'Fail on this level or higher (warning, critical, expired)', 'critical')
  .action((options) => {
    try {
      if (!configExists()) {
        console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        process.exit(1);
      }

      const results = checkSecrets();
      const total = results.healthy.length + results.warning.length + results.critical.length + results.expired.length;

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

      // CI mode exit codes
      if (options.ci) {
        const failLevel = options.failOn;
        
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

      if (results.expired.length > 0 || results.critical.length > 0) {
        console.log(chalk.red('⚠️  Action required! Rotate or renew these secrets.'));
      } else if (results.warning.length > 0) {
        console.log(chalk.yellow('⚠️  Some secrets need attention soon.'));
      } else {
        console.log(chalk.green('✓ All secrets are healthy!'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Remove command
program
  .command('remove <name>')
  .description('Stop tracking a secret')
  .action((name) => {
    try {
      if (!configExists()) {
        console.error(chalk.red('Error:'), 'No config file found.');
        process.exit(1);
      }

      removeSecret(name);
      console.log(chalk.green('✓ Secret removed:'), name);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Rotate command
program
  .command('rotate <name>')
  .description('Mark a secret as rotated (updates last-rotated date)')
  .action((name) => {
    try {
      if (!configExists()) {
        console.error(chalk.red('Error:'), 'No config file found.');
        process.exit(1);
      }

      const secret = rotateSecret(name);
      const emoji = getStatusEmoji(secret.status);
      
      console.log(chalk.green('✓ Secret rotated:'), secret.name);
      console.log(`  New status: ${emoji} ${secret.status}`);
      console.log(`  Last rotated: ${secret.lastRotated}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate audit report')
  .option('-f, --format <format>', 'Report format (text, json, markdown)', 'text')
  .option('-o, --output <file>', 'Output file (defaults to stdout)')
  .action((options) => {
    try {
      if (!configExists()) {
        console.error(chalk.red('Error:'), 'No config file found.');
        process.exit(1);
      }

      const config = loadConfig();
      
      if (config.tier === 'free' && options.format !== 'text') {
        console.error(chalk.red('Error:'), 'JSON and Markdown reports are Pro features. Upgrade to use this feature.');
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
        const fs = await import('fs');
        fs.writeFileSync(options.output, report, 'utf8');
        console.log(chalk.green('✓ Report saved to:'), options.output);
      } else {
        console.log(report);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// AWS Scanner
program
  .command('scan-aws')
  .description('Scan AWS IAM for access keys (Pro feature)')
  .option('--auto-add', 'Automatically add discovered keys to tracking')
  .action(async (options) => {
    try {
      if (!configExists()) {
        console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        process.exit(1);
      }

      const config = loadConfig();
      
      if (config.tier === 'free') {
        console.error(chalk.red('Error:'), 'AWS scanning is a Pro feature. Upgrade to use this feature.');
        console.log(chalk.cyan('\nPro features include:'));
        console.log('  • Unlimited secrets');
        console.log('  • AWS IAM scanner');
        console.log('  • GitHub PAT scanner');
        console.log('  • JSON/Markdown reports');
        console.log('  • CI/CD integration');
        process.exit(1);
      }

      if (!awsScanner.isAvailable()) {
        console.error(chalk.red('Error:'), 'AWS SDK not installed.');
        console.log('Install with: npm install @aws-sdk/client-iam');
        process.exit(1);
      }

      console.log(chalk.cyan('Scanning AWS IAM access keys...'));
      
      const keys = await awsScanner.scanAwsKeys();
      
      if (keys.length === 0) {
        console.log(chalk.yellow('No AWS access keys found.'));
        return;
      }

      console.log(chalk.green(`\n✓ Found ${keys.length} AWS access key${keys.length === 1 ? '' : 's'}:\n`));

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
            // Skip if already exists
            if (!error.message.includes('already exists')) {
              console.error(chalk.yellow(`  Warning: Could not add ${secret.name}: ${error.message}`));
            }
          }
        }
        
        console.log(chalk.green(`✓ Added ${added} new secret${added === 1 ? '' : 's'} to tracking`));
      } else {
        console.log(chalk.cyan('Use --auto-add to automatically track these keys'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// GitHub Scanner
program
  .command('scan-github')
  .description('Scan GitHub for Personal Access Tokens (Pro feature)')
  .option('--auto-add', 'Automatically add discovered tokens to tracking')
  .action(async (options) => {
    try {
      if (!configExists()) {
        console.error(chalk.red('Error:'), 'No config file found. Run "mpx-secrets-audit init" first.');
        process.exit(1);
      }

      const config = loadConfig();
      
      if (config.tier === 'free') {
        console.error(chalk.red('Error:'), 'GitHub scanning is a Pro feature. Upgrade to use this feature.');
        process.exit(1);
      }

      if (!githubScanner.isAvailable()) {
        console.error(chalk.red('Error:'), 'Octokit not installed.');
        console.log('Install with: npm install @octokit/rest');
        process.exit(1);
      }

      console.log(chalk.cyan('Scanning GitHub tokens...'));
      
      const tokens = await githubScanner.scanGitHubTokens();
      
      console.log(chalk.green(`\n✓ GitHub token verified\n`));

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
      } else {
        console.log(chalk.cyan('Use --auto-add to automatically track this token'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
