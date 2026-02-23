/**
 * McpToolAdapter - Wraps MCP server tools as the local Tool interface.
 *
 * Converts MCP tool definitions into Tool objects that can be registered
 * in the ToolRegistry and used by the AgentLoop.
 *
 * Tool naming convention: {serverName}__{toolName}
 * This prevents name collisions when multiple MCP servers provide
 * tools with the same name.
 */

import type { Tool, ToolContext, ToolResult } from '../tools/types.js';
import type { McpClient } from './McpClient.js';
import type { McpToolDefinition } from './types.js';
import { McpToolError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('McpToolAdapter');

/** Separator used in tool names: serverName__toolName */
const NAME_SEPARATOR = '__';

/**
 * Create a Tool implementation that delegates to an MCP server.
 */
export function createMcpTool(
    serverName: string,
    toolDef: McpToolDefinition,
    client: McpClient,
): Tool {
    const qualifiedName = `${serverName}${NAME_SEPARATOR}${toolDef.name}`;

    return {
        name: qualifiedName,
        description: `[MCP:${serverName}] ${toolDef.description || toolDef.name}`,
        parameterSchema: toolDef.inputSchema,
        requiresApproval: true, // MCP tools always require approval (external server)

        async execute(
            params: Record<string, unknown>,
            _context: ToolContext,
        ): Promise<ToolResult> {
            try {
                logger.info(`Calling MCP tool: ${qualifiedName}`);

                const result = await client.callTool(toolDef.name, params);

                // Extract text content from MCP result
                const textParts = result.content
                    .filter((c) => c.type === 'text' && c.text)
                    .map((c) => c.text!);

                const output = textParts.join('\n') || '(No text output)';

                return {
                    success: !result.isError,
                    output,
                    metadata: {
                        mcpServer: serverName,
                        mcpTool: toolDef.name,
                        contentTypes: result.content.map((c) => c.type),
                    },
                };
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                logger.error(`MCP tool ${qualifiedName} failed`, error);

                throw new McpToolError(
                    serverName,
                    toolDef.name,
                    errMsg,
                    error instanceof Error ? error : undefined,
                );
            }
        },
    };
}

/**
 * Convert all MCP tool definitions from a server into Tool instances.
 */
export function createMcpTools(
    serverName: string,
    toolDefs: McpToolDefinition[],
    client: McpClient,
): Tool[] {
    return toolDefs.map((def) => createMcpTool(serverName, def, client));
}

/**
 * Parse a qualified MCP tool name back into server and tool components.
 */
export function parseMcpToolName(qualifiedName: string): {
    serverName: string;
    toolName: string;
} | null {
    const sepIndex = qualifiedName.indexOf(NAME_SEPARATOR);
    if (sepIndex === -1) return null;

    return {
        serverName: qualifiedName.slice(0, sepIndex),
        toolName: qualifiedName.slice(sepIndex + NAME_SEPARATOR.length),
    };
}
