/**
 * ask_user tool: Ask the user a question and wait for response.
 * The response comes back through the normal chat message flow.
 */

import type { Tool, ToolContext, ToolResult } from '../types.js';
import { deferred } from '../../../utils/async.js';

/** Callback interface for delivering user responses to pending questions. */
export interface AskUserCallback {
    onQuestionAsked: (question: string) => void;
    waitForResponse: () => Promise<string>;
}

let pendingQuestion: { resolve: (answer: string) => void } | null = null;

export class AskUserTool implements Tool {
    readonly name = 'ask_user';
    readonly description =
        'Ask the user a clarifying question and wait for their response. Use when you need more information to proceed.';
    readonly requiresApproval = false;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            question: { type: 'string', description: 'The question to ask the user' },
        },
        required: ['question'],
    };

    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        const question = params.question as string;

        // Create a deferred that will be resolved when the user responds
        const { promise, resolve } = deferred<string>();
        pendingQuestion = { resolve };

        // The question text is returned as the tool output,
        // which the agent loop will display to the user.
        // The agent loop should then wait for the next user message
        // and feed it as the response.
        return {
            success: true,
            output: `[Question for user]: ${question}`,
            metadata: { awaitingResponse: true, question },
        };
    }

    /**
     * Resolve the pending question with the user's answer.
     * Called by the agent loop when the user sends a response.
     */
    static resolveQuestion(answer: string): void {
        if (pendingQuestion) {
            pendingQuestion.resolve(answer);
            pendingQuestion = null;
        }
    }

    static hasPendingQuestion(): boolean {
        return pendingQuestion !== null;
    }
}
