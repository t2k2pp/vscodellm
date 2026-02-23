/**
 * McpServerManager - Manages the lifecycle of MCP servers.
 *
 * Responsibilities:
 *   - Load server configurations from .localllm/mcp.json
 *   - Start/stop MCP server processes
 *   - Register/unregister MCP tools in the ToolRegistry
 *   - Handle reconnection on server failure
 */

import * as fs from 'fs';
import * as path from 'path';
import type { McpServerConfig, McpToolInfo } from '../../types/skills.js';
import type { Tool } from '../tools/types.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import { McpClient } from './McpClient.js';
import { StdioTransport } from './McpTransport.js';
import { createMcpTools, parseMcpToolName } from './McpToolAdapter.js';
import { McpConnectionError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('McpServerManager');

/** Config file path relative to workspace root. */
const CONFIG_FILENAME = '.localllm/mcp.json';

interface ManagedServer {
    config: McpServerConfig;
    transport: StdioTransport;
    client: McpClient;
    tools: Tool[];
}

export class McpServerManager {
    private servers = new Map<string, ManagedServer>();
    private toolRegistry: ToolRegistry | null = null;

    /**
     * Set the ToolRegistry to use for dynamic tool registration.
     */
    setToolRegistry(registry: ToolRegistry): void {
        this.toolRegistry = registry;
    }

    /**
     * Load MCP server configurations from the config file.
     */
    loadConfig(workspaceRoot: string): McpServerConfig[] {
        const configPath = path.join(workspaceRoot, CONFIG_FILENAME);

        if (!fs.existsSync(configPath)) {
            logger.info('No MCP config file found');
            return [];
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(content);

            if (!config.servers || !Array.isArray(config.servers)) {
                logger.warn('MCP config missing "servers" array');
                return [];
            }

            const servers: McpServerConfig[] = config.servers.map(
                (s: Record<string, unknown>) => ({
                    name: String(s.name || ''),
                    transport: (s.transport as string) || 'stdio',
                    command: s.command as string | undefined,
                    args: (s.args as string[]) || [],
                    env: (s.env as Record<string, string>) || undefined,
                    url: s.url as string | undefined,
                }),
            );

            logger.info(`Loaded ${servers.length} MCP server config(s)`);
            return servers.filter((s) => s.name && (s.command || s.url));
        } catch (error) {
            logger.error(`Failed to parse MCP config: ${configPath}`, error);
            return [];
        }
    }

    /**
     * Start a single MCP server.
     */
    async startServer(config: McpServerConfig): Promise<Tool[]> {
        if (this.servers.has(config.name)) {
            logger.warn(`Server "${config.name}" already running`);
            return this.servers.get(config.name)!.tools;
        }

        if (config.transport !== 'stdio') {
            logger.warn(`Transport "${config.transport}" not yet supported for "${config.name}"`);
            return [];
        }

        if (!config.command) {
            logger.warn(`No command specified for stdio server "${config.name}"`);
            return [];
        }

        logger.info(`Starting MCP server: ${config.name}`);

        try {
            // Create transport and start process
            const transport = new StdioTransport(
                config.command,
                config.args || [],
                config.env,
                config.name,
            );
            await transport.start();

            // Create client and initialize
            const client = new McpClient(transport, config.name);
            await client.initialize();

            // List and register tools
            const toolDefs = await client.listTools();
            const tools = createMcpTools(config.name, toolDefs, client);

            // Register tools in registry
            if (this.toolRegistry) {
                this.toolRegistry.registerAll(tools);
            }

            // Track the managed server
            this.servers.set(config.name, {
                config,
                transport,
                client,
                tools,
            });

            logger.info(
                `MCP server "${config.name}" started with ${tools.length} tool(s): ${tools.map((t) => t.name).join(', ')}`,
            );

            return tools;
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to start MCP server "${config.name}": ${errMsg}`);
            throw new McpConnectionError(config.name, errMsg, error instanceof Error ? error : undefined);
        }
    }

    /**
     * Stop a specific MCP server and unregister its tools.
     */
    async stopServer(serverName: string): Promise<void> {
        const server = this.servers.get(serverName);
        if (!server) {
            return;
        }

        // Unregister tools
        if (this.toolRegistry) {
            for (const tool of server.tools) {
                this.toolRegistry.unregister(tool.name);
            }
        }

        // Close client and transport
        await server.client.close();
        this.servers.delete(serverName);

        logger.info(`MCP server "${serverName}" stopped`);
    }

    /**
     * Start all configured MCP servers.
     */
    async startAll(workspaceRoot: string): Promise<Tool[]> {
        const configs = this.loadConfig(workspaceRoot);
        const allTools: Tool[] = [];

        for (const config of configs) {
            try {
                const tools = await this.startServer(config);
                allTools.push(...tools);
            } catch (error) {
                logger.error(`Failed to start server "${config.name}"`, error);
                // Continue with other servers
            }
        }

        return allTools;
    }

    /**
     * Stop all running MCP servers.
     */
    async stopAll(): Promise<void> {
        const names = Array.from(this.servers.keys());
        for (const name of names) {
            await this.stopServer(name);
        }
    }

    /**
     * Get all currently registered MCP tools.
     */
    getRegisteredTools(): Tool[] {
        const allTools: Tool[] = [];
        for (const server of this.servers.values()) {
            allTools.push(...server.tools);
        }
        return allTools;
    }

    /**
     * Get information about all running servers.
     */
    getServerInfos(): McpToolInfo[] {
        const infos: McpToolInfo[] = [];
        for (const server of this.servers.values()) {
            for (const tool of server.tools) {
                const parsed = parseMcpToolName(tool.name);
                if (parsed) {
                    infos.push({
                        serverName: parsed.serverName,
                        name: parsed.toolName,
                        description: tool.description,
                        inputSchema: tool.parameterSchema,
                    });
                }
            }
        }
        return infos;
    }

    /**
     * Get the number of running servers.
     */
    get serverCount(): number {
        return this.servers.size;
    }
}
