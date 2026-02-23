/**
 * Tool registration and lookup.
 * Provides OpenAI-compatible tool definitions for function calling
 * and XML descriptions for prompt-based tool calling.
 */

import type { ToolDefinition } from '../llm/types.js';
import type { Tool } from './types.js';

export class ToolRegistry {
    private tools = new Map<string, Tool>();

    /** Register a tool. */
    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    /** Get a tool by name. */
    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /** Get all registered tools. */
    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    /** Get OpenAI-compatible tool definitions for native function calling. */
    getToolDefinitions(): ToolDefinition[] {
        return this.getAll().map((tool) => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameterSchema,
            },
        }));
    }

    /** Get XML descriptions for prompt-based (XML fallback) tool calling. */
    getToolDescriptions(): string {
        return this.getAll()
            .map(
                (tool) =>
                    `<tool name="${tool.name}">
<description>${tool.description}</description>
<parameters>${JSON.stringify(tool.parameterSchema, null, 2)}</parameters>
</tool>`,
            )
            .join('\n\n');
    }
}
