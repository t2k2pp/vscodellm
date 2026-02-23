/**
 * Tool dispatch and execution.
 * Parses tool call arguments, validates them, and executes the handler.
 */

import type { ToolCall } from '../llm/types.js';
import type { ToolContext } from './types.js';
import type { ToolRegistry } from './ToolRegistry.js';
import type { ToolValidator } from './ToolValidator.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ToolExecutor');

export interface ToolExecutionResult {
    toolCallId: string;
    toolName: string;
    output: string;
    success: boolean;
}

export class ToolExecutor {
    constructor(
        private registry: ToolRegistry,
        private validator: ToolValidator,
    ) {}

    /**
     * Execute a single tool call.
     */
    async execute(
        toolCall: ToolCall,
        context: ToolContext,
    ): Promise<ToolExecutionResult> {
        const tool = this.registry.get(toolCall.function.name);
        if (!tool) {
            return {
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                output: `Error: Unknown tool "${toolCall.function.name}"`,
                success: false,
            };
        }

        // Parse arguments
        let params: Record<string, unknown>;
        try {
            params = JSON.parse(toolCall.function.arguments);
        } catch {
            return {
                toolCallId: toolCall.id,
                toolName: tool.name,
                output: 'Error: Invalid JSON in tool arguments',
                success: false,
            };
        }

        // Validate parameters
        const validation = this.validator.validate(tool, params);
        if (!validation.valid) {
            return {
                toolCallId: toolCall.id,
                toolName: tool.name,
                output: `Error: Invalid parameters: ${validation.errors.join(', ')}`,
                success: false,
            };
        }

        // Execute
        logger.info(`Executing tool: ${tool.name}`, params);
        try {
            const result = await tool.execute(params, context);
            logger.info(`Tool ${tool.name} completed`, { success: result.success });
            return {
                toolCallId: toolCall.id,
                toolName: tool.name,
                output: result.output,
                success: result.success,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Tool ${tool.name} threw an error: ${message}`);
            return {
                toolCallId: toolCall.id,
                toolName: tool.name,
                output: `Error executing ${tool.name}: ${message}`,
                success: false,
            };
        }
    }

    /**
     * Execute multiple tool calls in sequence.
     */
    async executeAll(
        toolCalls: ToolCall[],
        context: ToolContext,
    ): Promise<ToolExecutionResult[]> {
        const results: ToolExecutionResult[] = [];
        for (const tc of toolCalls) {
            // Check abort between tool calls
            if (context.abortSignal.aborted) {
                results.push({
                    toolCallId: tc.id,
                    toolName: tc.function.name,
                    output: 'Aborted',
                    success: false,
                });
                break;
            }
            results.push(await this.execute(tc, context));
        }
        return results;
    }
}
