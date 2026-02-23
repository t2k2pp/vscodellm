/**
 * Tool Call Accumulator.
 * Streaming tool calls arrive in delta chunks. This class reassembles them.
 */

import type { ToolCall } from '../llm/types.js';

interface InProgressToolCall {
    id: string;
    functionName: string;
    argumentsBuffer: string;
}

export class ToolCallAccumulator {
    private inProgress = new Map<number, InProgressToolCall>();

    /**
     * Add a streaming delta for a tool call.
     * Deltas include partial function name and argument fragments.
     */
    addDelta(delta: Partial<ToolCall> & { index?: number }): void {
        const index = delta.index ?? 0;

        if (!this.inProgress.has(index)) {
            this.inProgress.set(index, {
                id: delta.id || `call_${index}`,
                functionName: delta.function?.name || '',
                argumentsBuffer: '',
            });
        }

        const entry = this.inProgress.get(index)!;
        if (delta.id) entry.id = delta.id;
        if (delta.function?.name) entry.functionName = delta.function.name;
        if (delta.function?.arguments) entry.argumentsBuffer += delta.function.arguments;
    }

    /**
     * Get all completed tool calls assembled from deltas.
     */
    getCompleted(): ToolCall[] {
        return Array.from(this.inProgress.values())
            .filter((entry) => entry.functionName) // Must have a function name
            .map((entry) => ({
                id: entry.id,
                type: 'function' as const,
                function: {
                    name: entry.functionName,
                    arguments: entry.argumentsBuffer,
                },
            }));
    }

    /** Reset the accumulator. */
    clear(): void {
        this.inProgress.clear();
    }

    /** Whether any tool calls are being accumulated. */
    get hasToolCalls(): boolean {
        return this.inProgress.size > 0;
    }
}

/**
 * Parse XML-format tool calls from LLM text output.
 * Used as a fallback when the model doesn't support native function calling.
 *
 * Expected format:
 * <tool_call>
 * <tool_name>tool_name_here</tool_name>
 * <parameters>
 * {"param1": "value1"}
 * </parameters>
 * </tool_call>
 */
export function parseXmlToolCalls(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const regex = /<tool_call>\s*<tool_name>(.*?)<\/tool_name>\s*<parameters>([\s\S]*?)<\/parameters>\s*<\/tool_call>/g;

    let match;
    let index = 0;
    while ((match = regex.exec(text)) !== null) {
        const name = match[1].trim();
        const argsText = match[2].trim();

        toolCalls.push({
            id: `xmlcall_${index}`,
            type: 'function',
            function: {
                name,
                arguments: argsText,
            },
        });
        index++;
    }

    return toolCalls;
}

/**
 * Strip tool call XML from the display text.
 */
export function stripToolCallXml(text: string): string {
    return text
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
        .trim();
}
