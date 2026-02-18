import { calculateAge, daysUntilExpiry, getStatusEmoji, getStatusMessage } from './status.js';

/**
 * Generate a text report
 */
export function generateTextReport(secrets) {
  if (secrets.length === 0) {
    return 'No secrets tracked yet. Run "mpx-secrets-audit add" to start tracking.';
  }

  const lines = [];
  lines.push('Secrets Audit Report');
  lines.push('='.repeat(50));
  lines.push('');

  secrets.forEach(secret => {
    const emoji = getStatusEmoji(secret.status);
    const age = calculateAge(secret);
    const daysToExpiry = daysUntilExpiry(secret);
    const message = getStatusMessage(secret);

    lines.push(`${emoji} ${secret.name}`);
    lines.push(`   Provider: ${secret.provider}`);
    lines.push(`   Type: ${secret.type}`);
    lines.push(`   Status: ${secret.status.toUpperCase()} - ${message}`);
    
    if (age !== null) {
      lines.push(`   Age: ${age} day${age === 1 ? '' : 's'}`);
    }
    
    if (daysToExpiry !== null) {
      lines.push(`   Expires in: ${daysToExpiry} days`);
    }
    
    if (secret.rotationPolicy) {
      lines.push(`   Rotation Policy: ${secret.rotationPolicy} days`);
    }
    
    if (secret.notes) {
      lines.push(`   Notes: ${secret.notes}`);
    }
    
    lines.push('');
  });

  // Summary
  const summary = {
    total: secrets.length,
    healthy: secrets.filter(s => s.status === 'healthy').length,
    warning: secrets.filter(s => s.status === 'warning').length,
    critical: secrets.filter(s => s.status === 'critical').length,
    expired: secrets.filter(s => s.status === 'expired').length
  };

  lines.push('Summary');
  lines.push('-'.repeat(50));
  lines.push(`Total: ${summary.total}`);
  lines.push(`🟢 Healthy: ${summary.healthy}`);
  lines.push(`🟡 Warning: ${summary.warning}`);
  lines.push(`🔴 Critical: ${summary.critical}`);
  lines.push(`⛔ Expired: ${summary.expired}`);

  return lines.join('\n');
}

/**
 * Generate a JSON report
 */
export function generateJsonReport(secrets) {
  const summary = {
    total: secrets.length,
    healthy: secrets.filter(s => s.status === 'healthy').length,
    warning: secrets.filter(s => s.status === 'warning').length,
    critical: secrets.filter(s => s.status === 'critical').length,
    expired: secrets.filter(s => s.status === 'expired').length
  };

  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary,
    secrets: secrets.map(secret => ({
      ...secret,
      age: calculateAge(secret),
      daysUntilExpiry: daysUntilExpiry(secret),
      statusMessage: getStatusMessage(secret)
    }))
  }, null, 2);
}

/**
 * Generate a Markdown report
 */
export function generateMarkdownReport(secrets) {
  if (secrets.length === 0) {
    return '# Secrets Audit Report\n\nNo secrets tracked yet.';
  }

  const lines = [];
  lines.push('# Secrets Audit Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');

  // Summary
  const summary = {
    total: secrets.length,
    healthy: secrets.filter(s => s.status === 'healthy').length,
    warning: secrets.filter(s => s.status === 'warning').length,
    critical: secrets.filter(s => s.status === 'critical').length,
    expired: secrets.filter(s => s.status === 'expired').length
  };

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total**: ${summary.total}`);
  lines.push(`- 🟢 **Healthy**: ${summary.healthy}`);
  lines.push(`- 🟡 **Warning**: ${summary.warning}`);
  lines.push(`- 🔴 **Critical**: ${summary.critical}`);
  lines.push(`- ⛔ **Expired**: ${summary.expired}`);
  lines.push('');

  // Secrets table
  lines.push('## Secrets');
  lines.push('');
  lines.push('| Status | Name | Provider | Age (days) | Expiry | Rotation Policy |');
  lines.push('|--------|------|----------|------------|--------|-----------------|');

  secrets.forEach(secret => {
    const emoji = getStatusEmoji(secret.status);
    const age = calculateAge(secret) || 'N/A';
    const expiry = daysUntilExpiry(secret);
    const expiryStr = expiry !== null ? `${expiry} days` : 'N/A';
    const rotation = secret.rotationPolicy ? `${secret.rotationPolicy} days` : 'N/A';

    lines.push(
      `| ${emoji} ${secret.status} | ${secret.name} | ${secret.provider} | ${age} | ${expiryStr} | ${rotation} |`
    );
  });

  lines.push('');

  // Details
  if (summary.warning > 0 || summary.critical > 0 || summary.expired > 0) {
    lines.push('## Action Required');
    lines.push('');

    const actionRequired = secrets.filter(
      s => s.status !== 'healthy'
    );

    actionRequired.forEach(secret => {
      const emoji = getStatusEmoji(secret.status);
      const message = getStatusMessage(secret);

      lines.push(`### ${emoji} ${secret.name}`);
      lines.push('');
      lines.push(`- **Status**: ${secret.status.toUpperCase()}`);
      lines.push(`- **Message**: ${message}`);
      lines.push(`- **Provider**: ${secret.provider}`);
      
      if (secret.notes) {
        lines.push(`- **Notes**: ${secret.notes}`);
      }
      
      lines.push('');
    });
  }

  return lines.join('\n');
}
