/**
 * task_complete tool: Signal that the current task is finished.
 */

import type { Tool, ToolContext, ToolResult } from '../types.js';

export class TaskCompleteTool implements Tool {
    readonly name = 'task_complete';
    readonly description =
        'Signal that the current task is complete. Provide a summary of what was accomplished.';
    readonly requiresApproval = false;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            summary: { type: 'string', description: 'Summary of what was accomplished' },
        },
        required: ['summary'],
    };

    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        const summary = params.summary as string;

        return {
            success: true,
            output: summary,
            metadata: { taskComplete: true },
        };
    }
}
