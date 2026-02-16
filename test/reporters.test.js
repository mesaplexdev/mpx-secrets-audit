import { test } from 'node:test';
import assert from 'node:assert';
import { generateTextReport, generateJsonReport, generateMarkdownReport } from '../lib/reporters.js';

const testSecrets = [
  {
    name: 'stripe-key',
    provider: 'stripe',
    type: 'api_key',
    status: 'healthy',
    createdAt: '2025-01-01',
    lastRotated: '2025-01-01',
    rotationPolicy: 90,
    expiresAt: null,
    notes: 'Production key'
  },
  {
    name: 'aws-key',
    provider: 'aws',
    type: 'access_key',
    status: 'warning',
    createdAt: '2024-11-01',
    lastRotated: '2024-11-01',
    rotationPolicy: 90,
    expiresAt: null,
    notes: ''
  }
];

test('reporters: generateTextReport produces readable output', () => {
  const report = generateTextReport(testSecrets);
  
  assert.ok(report.includes('Secrets Audit Report'), 'Should include title');
  assert.ok(report.includes('stripe-key'), 'Should include secret name');
  assert.ok(report.includes('aws-key'), 'Should include second secret');
  assert.ok(report.includes('Summary'), 'Should include summary');
  assert.ok(report.includes('Total: 2'), 'Should show correct total');
});

test('reporters: generateTextReport handles empty secrets list', () => {
  const report = generateTextReport([]);
  
  assert.ok(report.includes('No secrets tracked yet'), 'Should show empty message');
});

test('reporters: generateJsonReport produces valid JSON', () => {
  const report = generateJsonReport(testSecrets);
  const parsed = JSON.parse(report);
  
  assert.ok(parsed.generatedAt, 'Should include timestamp');
  assert.ok(parsed.summary, 'Should include summary');
  assert.strictEqual(parsed.secrets.length, 2, 'Should include all secrets');
  assert.strictEqual(parsed.summary.total, 2, 'Should have correct total');
  assert.ok(parsed.secrets[0].age !== undefined, 'Should calculate age');
});

test('reporters: generateMarkdownReport produces markdown format', () => {
  const report = generateMarkdownReport(testSecrets);
  
  assert.ok(report.includes('# Secrets Audit Report'), 'Should have markdown title');
  assert.ok(report.includes('## Summary'), 'Should have summary section');
  assert.ok(report.includes('## Secrets'), 'Should have secrets section');
  assert.ok(report.includes('|'), 'Should include table');
  assert.ok(report.includes('stripe-key'), 'Should include secret names');
});

test('reporters: generateMarkdownReport shows action required section', () => {
  const report = generateMarkdownReport(testSecrets);
  
  // Should show action required since we have a warning status
  assert.ok(report.includes('## Action Required'), 'Should include action required section');
  assert.ok(report.includes('aws-key'), 'Should list warning secret');
});

test('reporters: generateMarkdownReport handles empty list', () => {
  const report = generateMarkdownReport([]);
  
  assert.ok(report.includes('No secrets tracked yet'), 'Should show empty message');
});
