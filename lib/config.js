import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';

const LOCAL_CONFIG = '.secrets-audit.json';
const GLOBAL_CONFIG_DIR = join(homedir(), '.config', 'mpx-secrets-audit');
const GLOBAL_CONFIG = join(GLOBAL_CONFIG_DIR, 'config.json');

/**
 * Get the path to the config file (local takes precedence)
 */
export function getConfigPath() {
  if (existsSync(LOCAL_CONFIG)) {
    return LOCAL_CONFIG;
  }
  return GLOBAL_CONFIG;
}

/**
 * Check if a config file exists
 */
export function configExists() {
  return existsSync(LOCAL_CONFIG) || existsSync(GLOBAL_CONFIG);
}

/**
 * Load the config file
 */
export function loadConfig() {
  const configPath = getConfigPath();
  
  if (!existsSync(configPath)) {
    throw new Error(
      'No config file found. Run "mpx-secrets-audit init" to create one.'
    );
  }

  try {
    const data = readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    
    if (!config.secrets) {
      config.secrets = [];
    }
    
    return config;
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

/**
 * Save the config file
 */
export function saveConfig(config, useGlobal = false) {
  const configPath = useGlobal ? GLOBAL_CONFIG : LOCAL_CONFIG;
  
  // Ensure directory exists for global config
  if (useGlobal) {
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return configPath;
  } catch (error) {
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

/**
 * Initialize a new config file
 */
export function initConfig(useGlobal = false) {
  const configPath = useGlobal ? GLOBAL_CONFIG : LOCAL_CONFIG;
  
  if (existsSync(configPath)) {
    throw new Error(`Config file already exists at ${configPath}`);
  }

  const initialConfig = {
    version: '1.0.0',
    tier: 'free',
    secrets: []
  };

  return saveConfig(initialConfig, useGlobal);
}
