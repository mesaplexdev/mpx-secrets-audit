import { loadConfig, saveConfig } from './config.js';
import { calculateStatus } from './status.js';

/**
 * Add a new secret to track
 */
export function addSecret(secretData) {
  const config = loadConfig();
  
  // Check free tier limit (10 secrets)
  if (config.tier === 'free' && config.secrets.length >= 10) {
    throw new Error(
      'Free tier limit reached (10 secrets). Upgrade to Pro for unlimited secrets.'
    );
  }
  
  // Check for duplicate names
  if (config.secrets.some(s => s.name === secretData.name)) {
    throw new Error(`Secret with name "${secretData.name}" already exists`);
  }
  
  // Validate required fields
  if (!secretData.name) {
    throw new Error('Secret name is required');
  }
  
  // Create secret with defaults
  const secret = {
    name: secretData.name,
    provider: secretData.provider || 'unknown',
    type: secretData.type || 'api_key',
    createdAt: secretData.createdAt || new Date().toISOString().split('T')[0],
    expiresAt: secretData.expiresAt || null,
    lastRotated: secretData.lastRotated || secretData.createdAt || new Date().toISOString().split('T')[0],
    rotationPolicy: secretData.rotationPolicy || 90,
    notes: secretData.notes || ''
  };
  
  // Calculate initial status
  secret.status = calculateStatus(secret);
  
  config.secrets.push(secret);
  saveConfig(config);
  
  return secret;
}

/**
 * Remove a secret
 */
export function removeSecret(name) {
  const config = loadConfig();
  const index = config.secrets.findIndex(s => s.name === name);
  
  if (index === -1) {
    throw new Error(`Secret "${name}" not found`);
  }
  
  const removed = config.secrets.splice(index, 1)[0];
  saveConfig(config);
  
  return removed;
}

/**
 * List all secrets
 */
export function listSecrets() {
  const config = loadConfig();
  
  // Recalculate status for each secret
  config.secrets.forEach(secret => {
    secret.status = calculateStatus(secret);
  });
  
  return config.secrets;
}

/**
 * Get a specific secret
 */
export function getSecret(name) {
  const config = loadConfig();
  const secret = config.secrets.find(s => s.name === name);
  
  if (!secret) {
    throw new Error(`Secret "${name}" not found`);
  }
  
  secret.status = calculateStatus(secret);
  return secret;
}

/**
 * Update a secret's rotation date
 */
export function rotateSecret(name) {
  const config = loadConfig();
  const secret = config.secrets.find(s => s.name === name);
  
  if (!secret) {
    throw new Error(`Secret "${name}" not found`);
  }
  
  secret.lastRotated = new Date().toISOString().split('T')[0];
  secret.status = calculateStatus(secret);
  
  saveConfig(config);
  return secret;
}

/**
 * Update a secret
 */
export function updateSecret(name, updates) {
  const config = loadConfig();
  const secret = config.secrets.find(s => s.name === name);
  
  if (!secret) {
    throw new Error(`Secret "${name}" not found`);
  }
  
  Object.assign(secret, updates);
  secret.status = calculateStatus(secret);
  
  saveConfig(config);
  return secret;
}

/**
 * Check all secrets and return those with warnings/critical/expired status
 */
export function checkSecrets() {
  const secrets = listSecrets();
  
  const results = {
    healthy: [],
    warning: [],
    critical: [],
    expired: []
  };
  
  secrets.forEach(secret => {
    results[secret.status].push(secret);
  });
  
  return results;
}
