/**
 * SubAgentTool - Allows the agent to spawn a sub-agent for complex subtasks.
 *
 * The sub-agent runs its own AgentLoop with an independent conversation history
 * and optionally filtered tool set. This enables task decomposition where the
 * main agent delegates work to focused sub-agents.
 */

import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { SubAgentManager } from '../../agent/SubAgentManager.js';
import type { AgentLoopDependencies } from '../../agent/types.js';

export class SubAgentTool implements Tool {
    readonly name = 'spawn_subagent';
    readonly description =
        'Spawn a sub-agent to handle a complex subtask autonomously. ' +
        'The sub-agent runs with its own conversation and can use tools independently. ' +
        'Use this to decompose complex tasks into smaller, focused pieces. ' +
        'The sub-agent will return its final response when complete.';

    readonly parameterSchema = {
        type: 'object',
        properties: {
            prompt: {
                type: 'string',
                description:
                    'The task description for the sub-agent. Be specific and detailed about what you want it to accomplish.',
            },
            allowed_tools: {
                type: 'array',
                items: { type: 'string' },
                description:
                    'Optional list of tool names the sub-agent can use (e.g., ["read_file", "search_files"]). ' +
                    'If omitted, all tools are available.',
            },
            max_iterations: {
                type: 'number',
                description:
                    'Maximum number of iterations for the sub-agent (default: 10). ' +
                    'Use higher values for more complex tasks.',
            },
        },
        required: ['prompt'],
        additionalProperties: false,
    };

    readonly requiresApproval = true;

    private readonly subAgentManager: SubAgentManager;
    private readonly parentDeps: AgentLoopDependencies;

    constructor(subAgentManager: SubAgentManager, parentDeps: AgentLoopDependencies) {
        this.subAgentManager = subAgentManager;
        this.parentDeps = parentDeps;
    }

    async execute(
        params: Record<string, unknown>,
        _context: ToolContext,
    ): Promise<ToolResult> {
        const prompt = params['prompt'] as string;
        if (!prompt) {
            return {
                success: false,
                output: 'Error: prompt parameter is required.',
            };
        }

        const allowedTools = params['allowed_tools'] as string[] | undefined;
        const maxIterations = params['max_iterations'] as number | undefined;

        try {
            const result = await this.subAgentManager.spawn(
                {
                    prompt,
                    allowedTools,
                    maxIterations,
                },
                this.parentDeps,
            );

            return {
                success: result.success,
                output: result.output,
                metadata: {
                    iterationsUsed: result.iterationsUsed,
                    success: result.success,
                },
            };
        } catch (error) {
            return {
                success: false,
                output: `Sub-agent failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
