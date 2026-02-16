/**
 * MCP (Model Context Protocol) Server
 * 
 * Exposes mpx-secrets-audit capabilities as MCP tools for AI agent integration.
 * Runs over stdio transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import {
  configExists,
  initConfig,
  addSecret,
  removeSecret,
  listSecrets,
  checkSecrets,
  rotateSecret,
  getStatusEmoji,
  getStatusMessage,
  calculateAge,
  daysUntilExpiry
} from './index.js';

import { getSchema } from './schema.js';
import pkg from '../package.json' with { type: 'json' };

export async function startMCPServer() {
  const server = new Server(
    { name: 'mpx-secrets-audit', version: pkg.version },
    { capabilities: { tools: {} } }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'init',
          description: 'Create a new secrets audit config file. Returns config path.',
          inputSchema: {
            type: 'object',
            properties: {
              global: {
                type: 'boolean',
                description: 'Create config in global location (~/.config/mpx-secrets-audit/)',
                default: false
              }
            }
          }
        },
        {
          name: 'add_secret',
          description: 'Add a new secret to track. Returns the created secret with calculated status.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Unique identifier for the secret'
              },
              provider: {
                type: 'string',
                description: 'Service provider (e.g., stripe, aws, github)'
              },
              type: {
                type: 'string',
                description: 'Secret type (api_key, token, password)',
                default: 'api_key'
              },
              createdAt: {
                type: 'string',
                description: 'Creation date (YYYY-MM-DD). Defaults to today.'
              },
              expiresAt: {
                type: 'string',
                description: 'Expiry date (YYYY-MM-DD). Can be null for no expiry.'
              },
              rotationPolicy: {
                type: 'number',
                description: 'Rotation policy in days',
                default: 90
              },
              notes: {
                type: 'string',
                description: 'Additional notes'
              }
            },
            required: ['name']
          }
        },
        {
          name: 'list_secrets',
          description: 'List all tracked secrets with status, age, and expiry information.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'warning', 'critical', 'expired'],
                description: 'Filter by status'
              }
            }
          }
        },
        {
          name: 'check_secrets',
          description: 'Run audit and check for expiring/old secrets. Returns categorized results.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'remove_secret',
          description: 'Stop tracking a secret. Returns the removed secret.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of secret to remove'
              }
            },
            required: ['name']
          }
        },
        {
          name: 'rotate_secret',
          description: 'Mark a secret as rotated (updates last-rotated date to today). Returns updated secret.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of secret to rotate'
              }
            },
            required: ['name']
          }
        },
        {
          name: 'get_schema',
          description: 'Get the full JSON schema describing all mpx-secrets-audit commands and flags.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'init': {
          if (configExists()) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'Config file already exists',
                  code: 'ERR_CONFIG_EXISTS'
                }, null, 2)
              }],
              isError: true
            };
          }

          const configPath = initConfig(args.global || false);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                configPath,
                message: 'Config file created'
              }, null, 2)
            }]
          };
        }

        case 'add_secret': {
          if (!configExists()) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'No config file found. Run init first.',
                  code: 'ERR_NO_CONFIG'
                }, null, 2)
              }],
              isError: true
            };
          }

          const secret = addSecret({
            name: args.name,
            provider: args.provider,
            type: args.type || 'api_key',
            createdAt: args.createdAt,
            expiresAt: args.expiresAt || null,
            rotationPolicy: args.rotationPolicy || 90,
            notes: args.notes || ''
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                secret: {
                  ...secret,
                  age: calculateAge(secret),
                  daysUntilExpiry: daysUntilExpiry(secret),
                  message: getStatusMessage(secret)
                }
              }, null, 2)
            }]
          };
        }

        case 'list_secrets': {
          if (!configExists()) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'No config file found. Run init first.',
                  code: 'ERR_NO_CONFIG'
                }, null, 2)
              }],
              isError: true
            };
          }

          let secrets = listSecrets();

          if (args.status) {
            secrets = secrets.filter(s => s.status === args.status);
          }

          const enrichedSecrets = secrets.map(secret => ({
            ...secret,
            age: calculateAge(secret),
            daysUntilExpiry: daysUntilExpiry(secret),
            message: getStatusMessage(secret)
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: enrichedSecrets.length,
                secrets: enrichedSecrets
              }, null, 2)
            }]
          };
        }

        case 'check_secrets': {
          if (!configExists()) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'No config file found. Run init first.',
                  code: 'ERR_NO_CONFIG'
                }, null, 2)
              }],
              isError: true
            };
          }

          const results = checkSecrets();
          const total = results.healthy.length + results.warning.length + 
                       results.critical.length + results.expired.length;

          // Enrich each secret with additional info
          const enrichResults = {};
          for (const [status, secrets] of Object.entries(results)) {
            enrichResults[status] = secrets.map(s => ({
              ...s,
              age: calculateAge(s),
              daysUntilExpiry: daysUntilExpiry(s),
              message: getStatusMessage(s)
            }));
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
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
              }, null, 2)
            }]
          };
        }

        case 'remove_secret': {
          if (!configExists()) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'No config file found. Run init first.',
                  code: 'ERR_NO_CONFIG'
                }, null, 2)
              }],
              isError: true
            };
          }

          const removed = removeSecret(args.name);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                removed,
                message: `Secret "${args.name}" removed`
              }, null, 2)
            }]
          };
        }

        case 'rotate_secret': {
          if (!configExists()) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'No config file found. Run init first.',
                  code: 'ERR_NO_CONFIG'
                }, null, 2)
              }],
              isError: true
            };
          }

          const secret = rotateSecret(args.name);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                secret: {
                  ...secret,
                  age: calculateAge(secret),
                  daysUntilExpiry: daysUntilExpiry(secret),
                  message: getStatusMessage(secret)
                },
                message: `Secret "${args.name}" rotated`
              }, null, 2)
            }]
          };
        }

        case 'get_schema': {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(getSchema(), null, 2)
            }]
          };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true
          };
      }
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ 
            error: err.message, 
            code: 'ERR_OPERATION' 
          }, null, 2)
        }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
