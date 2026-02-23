/**
 * search_conversation_history tool: Search past conversation transcripts.
 *
 * Allows the agent to recover details from earlier in the conversation
 * that may have been lost during context compaction.
 */

import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { TranscriptSearcher } from '../../context/TranscriptSearcher.js';
import type { TranscriptEntryType, TranscriptSearchResult } from '../../../types/transcript.js';

export class SearchConversationHistoryTool implements Tool {
    readonly name = 'search_conversation_history';
    readonly description =
        'Search past conversation transcripts to recover details lost during context compaction. ' +
        'Use this when you need to recall specific earlier discussions, tool outputs, or decisions.';
    readonly requiresApproval = false;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query (regex supported). Searches message content, tool names, tool results, and summaries.',
            },
            conversation_id: {
                type: 'string',
                description: 'Specific conversation ID to search. Defaults to the current conversation.',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results to return (default: 20).',
            },
            entry_types: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by entry types: user_message, assistant_message, tool_call, tool_result, context_compacted.',
            },
        },
        required: ['query'],
    };

    constructor(
        private searcher: TranscriptSearcher,
        private currentConversationId: string = '',
    ) {}

    /** Update the current conversation ID (called per agent run). */
    setCurrentConversationId(id: string): void {
        this.currentConversationId = id;
    }

    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        const query = params.query as string;
        const conversationId = (params.conversation_id as string) || this.currentConversationId;
        const maxResults = (params.max_results as number) || 20;
        const entryTypes = params.entry_types as TranscriptEntryType[] | undefined;

        if (!query) {
            return { success: false, output: 'Error: query parameter is required.' };
        }

        if (!conversationId) {
            return { success: false, output: 'Error: No conversation ID available. Specify conversation_id parameter.' };
        }

        try {
            const results = this.searcher.search(conversationId, query, {
                maxResults,
                entryTypes,
            });

            if (results.length === 0) {
                return {
                    success: true,
                    output: `No matches found for "${query}" in conversation ${conversationId}.`,
                };
            }

            const output = this.formatResults(results);

            return {
                success: true,
                output: `Found ${results.length} matches for "${query}":\n\n${output}`,
                metadata: { matchCount: results.length, conversationId },
            };
        } catch (error) {
            return {
                success: false,
                output: `Search failed: ${(error as Error).message}`,
            };
        }
    }

    // ============================================
    // Formatting
    // ============================================

    private formatResults(results: TranscriptSearchResult[]): string {
        return results
            .map((r, i) => {
                const entry = r.entry;
                const time = new Date(entry.timestamp).toISOString();
                const header = `[${i + 1}] ${time} | ${entry.type}`;

                const lines: string[] = [header];

                switch (entry.type) {
                    case 'user_message':
                        lines.push(`  User: ${this.truncate(entry.content || '', 200)}`);
                        break;
                    case 'assistant_message':
                        if (entry.content) {
                            lines.push(`  Assistant: ${this.truncate(entry.content, 200)}`);
                        }
                        if (entry.toolCalls && entry.toolCalls.length > 0) {
                            const tools = entry.toolCalls.map((tc) => tc.name).join(', ');
                            lines.push(`  Tool calls: ${tools}`);
                        }
                        break;
                    case 'tool_call':
                        lines.push(`  Tool: ${entry.toolName}`);
                        if (entry.toolParams) {
                            lines.push(`  Params: ${this.truncate(JSON.stringify(entry.toolParams), 150)}`);
                        }
                        break;
                    case 'tool_result':
                        lines.push(`  Tool: ${entry.toolName} (${entry.toolSuccess ? 'success' : 'failed'})`);
                        lines.push(`  Result: ${this.truncate(entry.toolResult || '', 300)}`);
                        break;
                    case 'context_compacted':
                        lines.push(`  Summary: ${this.truncate(entry.summary || '', 300)}`);
                        break;
                    default:
                        if (entry.content) {
                            lines.push(`  ${this.truncate(entry.content, 200)}`);
                        }
                        break;
                }

                return lines.join('\n');
            })
            .join('\n\n');
    }

    private truncate(text: string, maxLen: number): string {
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen) + '...';
    }
}
