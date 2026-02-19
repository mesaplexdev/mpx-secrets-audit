/**
 * Schema Module
 * 
 * Returns a machine-readable JSON schema describing all commands,
 * flags, inputs, and outputs for AI agent discovery.
 */

import pkg from '../package.json' with { type: 'json' };

export function getSchema() {
  return {
    tool: 'mpx-secrets-audit',
    version: pkg.version,
    description: pkg.description,
    homepage: pkg.homepage,
    commands: {
      init: {
        description: 'Create a new secrets audit config file',
        usage: 'mpx-secrets-audit init [options]',
        arguments: {},
        flags: {
          '--global': {
            type: 'boolean',
            default: false,
            description: 'Create config in global location (~/.config/mpx-secrets-audit/)'
          }
        },
        output: {
          success: {
            description: 'Config file path on success',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                configPath: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        },
        exitCodes: {
          0: 'Success',
          1: 'Error creating config'
        }
      },
      add: {
        description: 'Add a new secret to track',
        usage: 'mpx-secrets-audit add <name> [options]',
        arguments: {
          name: {
            type: 'string',
            required: true,
            description: 'Unique identifier for the secret'
          }
        },
        flags: {
          '--provider': {
            type: 'string',
            description: 'Service provider (e.g., stripe, aws, github)'
          },
          '--type': {
            type: 'string',
            default: 'api_key',
            description: 'Secret type (api_key, token, password)'
          },
          '--created': {
            type: 'string',
            format: 'date',
            description: 'Creation date (YYYY-MM-DD)'
          },
          '--expires': {
            type: 'string',
            format: 'date',
            description: 'Expiry date (YYYY-MM-DD)'
          },
          '--rotation': {
            type: 'number',
            default: 90,
            description: 'Rotation policy in days'
          },
          '--notes': {
            type: 'string',
            description: 'Additional notes'
          },
          '--interactive': {
            type: 'boolean',
            default: false,
            description: 'Interactive mode (prompts for all fields)'
          },
          '--json': {
            type: 'boolean',
            default: false,
            description: 'Output as JSON'
          },
          '--quiet': {
            type: 'boolean',
            default: false,
            description: 'Suppress non-essential output'
          }
        },
        output: {
          json: {
            description: 'Secret object when --json is used',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                secret: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    provider: { type: 'string' },
                    type: { type: 'string' },
                    createdAt: { type: 'string', format: 'date' },
                    expiresAt: { type: 'string', format: 'date', nullable: true },
                    lastRotated: { type: 'string', format: 'date' },
                    rotationPolicy: { type: 'number' },
                    status: { type: 'string', enum: ['healthy', 'warning', 'critical', 'expired'] },
                    notes: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      list: {
        description: 'List all tracked secrets',
        usage: 'mpx-secrets-audit list [options]',
        arguments: {},
        flags: {
          '--status': {
            type: 'string',
            enum: ['healthy', 'warning', 'critical', 'expired'],
            description: 'Filter by status'
          },
          '--json': {
            type: 'boolean',
            default: false,
            description: 'Output as JSON'
          },
          '--quiet': {
            type: 'boolean',
            default: false,
            description: 'Suppress non-essential output'
          }
        },
        output: {
          json: {
            description: 'Array of secret objects when --json is used',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                count: { type: 'number' },
                secrets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      provider: { type: 'string' },
                      type: { type: 'string' },
                      createdAt: { type: 'string', format: 'date' },
                      expiresAt: { type: 'string', format: 'date', nullable: true },
                      lastRotated: { type: 'string', format: 'date' },
                      rotationPolicy: { type: 'number' },
                      status: { type: 'string', enum: ['healthy', 'warning', 'critical', 'expired'] },
                      notes: { type: 'string' },
                      age: { type: 'number', description: 'Age in days' },
                      daysUntilExpiry: { type: 'number', nullable: true, description: 'Days until expiry, null if no expiry' },
                      message: { type: 'string', description: 'Status message' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      check: {
        description: 'Run audit and check for expiring/old secrets',
        usage: 'mpx-secrets-audit check [options]',
        arguments: {},
        flags: {
          '--ci': {
            type: 'boolean',
            default: false,
            description: 'CI mode: exit with code 1 for warnings, 2 for critical/expired'
          },
          '--fail-on': {
            type: 'string',
            enum: ['warning', 'critical', 'expired'],
            description: 'Fail on this level or higher'
          },
          '--json': {
            type: 'boolean',
            default: false,
            description: 'Output as JSON'
          },
          '--quiet': {
            type: 'boolean',
            default: false,
            description: 'Suppress non-essential output'
          }
        },
        output: {
          json: {
            description: 'Audit results when --json is used',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                total: { type: 'number' },
                summary: {
                  type: 'object',
                  properties: {
                    healthy: { type: 'number' },
                    warning: { type: 'number' },
                    critical: { type: 'number' },
                    expired: { type: 'number' }
                  }
                },
                secrets: {
                  type: 'object',
                  properties: {
                    healthy: { type: 'array', items: { type: 'object' } },
                    warning: { type: 'array', items: { type: 'object' } },
                    critical: { type: 'array', items: { type: 'object' } },
                    expired: { type: 'array', items: { type: 'object' } }
                  }
                },
                actionRequired: { type: 'boolean' }
              }
            }
          }
        },
        exitCodes: {
          0: 'All secrets healthy',
          1: 'Warnings found (CI mode with --fail-on warning)',
          2: 'Critical or expired secrets found'
        }
      },
      remove: {
        description: 'Stop tracking a secret',
        usage: 'mpx-secrets-audit remove <name>',
        arguments: {
          name: {
            type: 'string',
            required: true,
            description: 'Name of secret to remove'
          }
        },
        flags: {
          '--json': {
            type: 'boolean',
            default: false,
            description: 'Output as JSON'
          },
          '--quiet': {
            type: 'boolean',
            default: false,
            description: 'Suppress non-essential output'
          }
        },
        output: {
          json: {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                removed: { type: 'object' },
                message: { type: 'string' }
              }
            }
          }
        }
      },
      rotate: {
        description: 'Mark a secret as rotated (updates last-rotated date)',
        usage: 'mpx-secrets-audit rotate <name>',
        arguments: {
          name: {
            type: 'string',
            required: true,
            description: 'Name of secret to rotate'
          }
        },
        flags: {
          '--json': {
            type: 'boolean',
            default: false,
            description: 'Output as JSON'
          },
          '--quiet': {
            type: 'boolean',
            default: false,
            description: 'Suppress non-essential output'
          }
        },
        output: {
          json: {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                secret: { type: 'object' },
                message: { type: 'string' }
              }
            }
          }
        }
      },
      report: {
        description: 'Generate audit report',
        usage: 'mpx-secrets-audit report [options]',
        arguments: {},
        flags: {
          '--format': {
            type: 'string',
            enum: ['text', 'json', 'markdown'],
            default: 'text',
            description: 'Report format'
          },
          '--pdf': {
            type: 'string',
            description: 'Export report as PDF to the given filename (requires pdfkit)'
          },
          '--output': {
            type: 'string',
            description: 'Output file (defaults to stdout)'
          },
          '--quiet': {
            type: 'boolean',
            default: false,
            description: 'Suppress non-essential output'
          }
        }
      },
      'scan-aws': {
        description: 'Scan AWS IAM for access keys (Pro feature)',
        usage: 'mpx-secrets-audit scan-aws [options]',
        arguments: {},
        flags: {
          '--auto-add': {
            type: 'boolean',
            default: false,
            description: 'Automatically add discovered keys to tracking'
          },
          '--json': {
            type: 'boolean',
            default: false,
            description: 'Output as JSON'
          },
          '--quiet': {
            type: 'boolean',
            default: false,
            description: 'Suppress non-essential output'
          }
        },
        requirements: ['Pro tier', 'AWS credentials', '@aws-sdk/client-iam package']
      },
      'scan-github': {
        description: 'Scan GitHub for Personal Access Tokens (Pro feature)',
        usage: 'mpx-secrets-audit scan-github [options]',
        arguments: {},
        flags: {
          '--auto-add': {
            type: 'boolean',
            default: false,
            description: 'Automatically add discovered tokens to tracking'
          },
          '--json': {
            type: 'boolean',
            default: false,
            description: 'Output as JSON'
          },
          '--quiet': {
            type: 'boolean',
            default: false,
            description: 'Suppress non-essential output'
          }
        },
        requirements: ['Pro tier', 'GITHUB_TOKEN environment variable', '@octokit/rest package']
      },
      mcp: {
        description: 'Start MCP (Model Context Protocol) stdio server for AI agent integration',
        usage: 'mpx-secrets-audit mcp',
        arguments: {},
        flags: {}
      },
      update: {
        description: 'Check for updates and optionally install the latest version',
        usage: 'mpx-secrets-audit update [--check] [--json]',
        flags: {
          '--check': { description: 'Only check for updates (do not install)', default: false },
          '--json': { description: 'Machine-readable JSON output', default: false }
        },
        examples: [
          { command: 'mpx-secrets-audit update', description: 'Check and install updates' },
          { command: 'mpx-secrets-audit update --check', description: 'Just check for updates' },
          { command: 'mpx-secrets-audit update --check --json', description: 'Check for updates (JSON output)' }
        ]
      },
      schema: {
        description: 'Output this JSON schema',
        usage: 'mpx-secrets-audit --schema',
        flags: {
          '--schema': {
            type: 'boolean',
            description: 'Output JSON schema'
          }
        }
      }
    },
    globalFlags: {
      '--json': {
        type: 'boolean',
        default: false,
        description: 'Output as JSON (machine-readable)'
      },
      '-q, --quiet': {
        type: 'boolean',
        default: false,
        description: 'Suppress non-essential output'
      },
      '--no-color': {
        type: 'boolean',
        default: false,
        description: 'Disable colored output'
      },
      '--schema': {
        type: 'boolean',
        default: false,
        description: 'Output this schema as JSON'
      },
      '--version': {
        type: 'boolean',
        description: 'Show version number'
      },
      '--help': {
        type: 'boolean',
        description: 'Show help information'
      }
    },
    exitCodes: {
      0: 'Success',
      1: 'Error or warnings (depending on command)',
      2: 'Critical issues (check command in CI mode)'
    },
    mcpConfig: {
      description: 'Add to your MCP client configuration to use mpx-secrets-audit as an AI tool',
      config: {
        mcpServers: {
          'mpx-secrets-audit': {
            command: 'npx',
            args: ['mpx-secrets-audit', 'mcp']
          }
        }
      }
    }
  };
}
