/**
 * Auto-compaction logic.
 * When the conversation grows too long, summarizes older messages
 * rather than truncating them.
 */

import type { LlmProvider } from '../llm/LlmProvider.js';
import type { TokenCounter } from '../llm/TokenCounter.js';
import type { ConversationHistory } from './ConversationHistory.js';
import { SystemPrompt } from '../prompts/SystemPrompt.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ContextCompactor');

const KEEP_RECENT_COUNT = 6; // Keep last 6 messages (3 turns)

export class ContextCompactor {
    constructor(
        private provider: LlmProvider,
        private modelId: string,
    ) {}

    /**
     * Compact the conversation by summarizing older messages.
     * Strategy:
     * 1. Keep the most recent N messages intact
     * 2. Summarize everything older into a single context summary
     */
    async compact(
        history: ConversationHistory,
        tokenCounter: TokenCounter,
    ): Promise<void> {
        const messages = history.getMessages();

        if (messages.length <= KEEP_RECENT_COUNT) {
            return; // Nothing to compact
        }

        const olderMessages = messages.slice(0, -KEEP_RECENT_COUNT);
        const recentMessages = messages.slice(-KEEP_RECENT_COUNT);

        logger.info(
            `Compacting: ${olderMessages.length} older messages → summary, keeping ${recentMessages.length} recent`,
        );

        // Build the conversation text to summarize
        const conversationText = olderMessages
            .map((m) => `[${m.role}]: ${m.content || JSON.stringify(m.tool_calls)}`)
            .join('\n\n');

        const summaryPrompt = SystemPrompt.getCompactionPrompt(conversationText);

        try {
            const summaryResponse = await this.provider.complete({
                model: this.modelId,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that creates concise conversation summaries.',
                    },
                    { role: 'user', content: summaryPrompt },
                ],
                stream: false,
                max_tokens: 1024,
            });

            const summaryText = summaryResponse.choices[0]?.message.content || '';
            history.replaceWithSummary(summaryText, recentMessages);

            logger.info(`Compaction complete. Summary: ${tokenCounter.count(summaryText)} tokens`);
        } catch (error) {
            logger.error(`Compaction failed: ${(error as Error).message}`);
            // Fallback: just drop the oldest messages
            history.replaceWithSummary(
                '[Conversation history was truncated due to context limits]',
                recentMessages,
            );
        }
    }
}
