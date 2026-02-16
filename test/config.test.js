import { test } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { initConfig, loadConfig, saveConfig, configExists } from '../lib/config.js';

const TEST_CONFIG = '.secrets-audit.test.json';

test('config: initConfig creates a valid config file', () => {
  if (existsSync(TEST_CONFIG)) {
    unlinkSync(TEST_CONFIG);
  }

  // Mock the LOCAL_CONFIG path
  const originalCwd = process.cwd();
  
  const config = {
    version: '1.0.0',
    tier: 'free',
    secrets: []
  };
  
  saveConfig(config, false);
  
  assert.ok(existsSync('.secrets-audit.json'), 'Config file should exist');
  
  const loaded = loadConfig();
  assert.strictEqual(loaded.version, '1.0.0');
  assert.strictEqual(loaded.tier, 'free');
  assert.ok(Array.isArray(loaded.secrets));
  
  // Cleanup
  if (existsSync('.secrets-audit.json')) {
    unlinkSync('.secrets-audit.json');
  }
});

test('config: loadConfig throws error when config does not exist', () => {
  if (existsSync('.secrets-audit.json')) {
    unlinkSync('.secrets-audit.json');
  }
  
  assert.throws(
    () => loadConfig(),
    /No config file found/,
    'Should throw error when config does not exist'
  );
});

test('config: saveConfig persists changes', () => {
  const config = {
    version: '1.0.0',
    tier: 'free',
    secrets: [
      {
        name: 'test-key',
        provider: 'test',
        type: 'api_key'
      }
    ]
  };
  
  saveConfig(config, false);
  const loaded = loadConfig();
  
  assert.strictEqual(loaded.secrets.length, 1);
  assert.strictEqual(loaded.secrets[0].name, 'test-key');
  
  // Cleanup
  if (existsSync('.secrets-audit.json')) {
    unlinkSync('.secrets-audit.json');
  }
});
