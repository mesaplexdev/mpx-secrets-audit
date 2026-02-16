import { test } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'fs';
import { saveConfig } from '../lib/config.js';
import { addSecret, removeSecret, listSecrets, getSecret, rotateSecret, checkSecrets } from '../lib/secrets.js';

function setupTestConfig() {
  const config = {
    version: '1.0.0',
    tier: 'free',
    secrets: []
  };
  saveConfig(config, false);
}

function cleanupTestConfig() {
  if (existsSync('.secrets-audit.json')) {
    unlinkSync('.secrets-audit.json');
  }
}

test('secrets: addSecret adds a new secret', () => {
  setupTestConfig();
  
  const secretData = {
    name: 'test-key',
    provider: 'stripe',
    type: 'api_key',
    rotationPolicy: 90
  };
  
  const secret = addSecret(secretData);
  
  assert.strictEqual(secret.name, 'test-key');
  assert.strictEqual(secret.provider, 'stripe');
  assert.ok(secret.status, 'Status should be calculated');
  
  cleanupTestConfig();
});

test('secrets: addSecret throws error for duplicate names', () => {
  setupTestConfig();
  
  const secretData = {
    name: 'test-key',
    provider: 'stripe',
    type: 'api_key'
  };
  
  addSecret(secretData);
  
  assert.throws(
    () => addSecret(secretData),
    /already exists/,
    'Should throw error for duplicate names'
  );
  
  cleanupTestConfig();
});

test('secrets: addSecret enforces free tier limit', () => {
  setupTestConfig();
  
  // Add 10 secrets (free tier limit)
  for (let i = 0; i < 10; i++) {
    addSecret({
      name: `test-key-${i}`,
      provider: 'test',
      type: 'api_key'
    });
  }
  
  // 11th secret should fail
  assert.throws(
    () => addSecret({ name: 'test-key-11', provider: 'test' }),
    /Free tier limit reached/,
    'Should throw error when free tier limit reached'
  );
  
  cleanupTestConfig();
});

test('secrets: removeSecret removes a secret', () => {
  setupTestConfig();
  
  addSecret({ name: 'test-key', provider: 'test' });
  
  const removed = removeSecret('test-key');
  assert.strictEqual(removed.name, 'test-key');
  
  const secrets = listSecrets();
  assert.strictEqual(secrets.length, 0);
  
  cleanupTestConfig();
});

test('secrets: removeSecret throws error for non-existent secret', () => {
  setupTestConfig();
  
  assert.throws(
    () => removeSecret('nonexistent'),
    /not found/,
    'Should throw error for non-existent secret'
  );
  
  cleanupTestConfig();
});

test('secrets: listSecrets returns all secrets', () => {
  setupTestConfig();
  
  addSecret({ name: 'test-key-1', provider: 'test' });
  addSecret({ name: 'test-key-2', provider: 'test' });
  addSecret({ name: 'test-key-3', provider: 'test' });
  
  const secrets = listSecrets();
  assert.strictEqual(secrets.length, 3);
  
  cleanupTestConfig();
});

test('secrets: getSecret retrieves a specific secret', () => {
  setupTestConfig();
  
  addSecret({ name: 'test-key', provider: 'stripe' });
  
  const secret = getSecret('test-key');
  assert.strictEqual(secret.name, 'test-key');
  assert.strictEqual(secret.provider, 'stripe');
  
  cleanupTestConfig();
});

test('secrets: rotateSecret updates last rotated date', () => {
  setupTestConfig();
  
  const date = new Date();
  date.setDate(date.getDate() - 50);
  
  addSecret({
    name: 'test-key',
    provider: 'test',
    lastRotated: date.toISOString().split('T')[0]
  });
  
  const rotated = rotateSecret('test-key');
  
  const today = new Date().toISOString().split('T')[0];
  assert.strictEqual(rotated.lastRotated, today);
  
  cleanupTestConfig();
});

test('secrets: checkSecrets categorizes secrets by status', () => {
  setupTestConfig();
  
  // Add healthy secret
  addSecret({
    name: 'healthy-key',
    provider: 'test',
    rotationPolicy: 90
  });
  
  // Add warning secret (old)
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 70);
  addSecret({
    name: 'warning-key',
    provider: 'test',
    lastRotated: oldDate.toISOString().split('T')[0],
    rotationPolicy: 90
  });
  
  // Add critical secret (very old)
  const veryOldDate = new Date();
  veryOldDate.setDate(veryOldDate.getDate() - 100);
  addSecret({
    name: 'critical-key',
    provider: 'test',
    lastRotated: veryOldDate.toISOString().split('T')[0],
    rotationPolicy: 90
  });
  
  const results = checkSecrets();
  
  assert.strictEqual(results.healthy.length, 1);
  assert.strictEqual(results.warning.length, 1);
  assert.strictEqual(results.critical.length, 1);
  assert.strictEqual(results.expired.length, 0);
  
  cleanupTestConfig();
});
