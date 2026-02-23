/**
 * Context budget management.
 * Tracks token usage and triggers compaction when needed.
 */

import type { LlmProvider } from '../llm/LlmProvider.js';
import type { ChatMessage, ModelInfo as LlmModelInfo } from '../llm/types.js';
import { TokenCounter } from '../llm/TokenCounter.js';
import { ContextCompactor } from './ContextCompactor.js';
import type { ConversationHistory } from './ConversationHistory.js';
import type { TranscriptLogger } from './TranscriptLogger.js';
import type { ContextSettings } from './types.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ContextManager');

export class ContextManager {
    private tokenCounter: TokenCounter;
    private compactor: ContextCompactor;
    private transcriptLogger?: TranscriptLogger;
    private conversationId?: string;

    constructor(
        private provider: LlmProvider,
        private settings: ContextSettings,
    ) {
        this.tokenCounter = TokenCounter.getInstance();
        this.compactor = new ContextCompactor(provider, settings.modelId);
    }

    /** Set transcript logger for compaction event logging. */
    setTranscriptLogger(logger: TranscriptLogger, conversationId: string): void {
        this.transcriptLogger = logger;
        this.conversationId = conversationId;
    }

    /**
     * Calculate the available token budget.
     * budget = min(contextWindow - reservedForOutput, contextWindow * safetyRatio)
     */
    getTokenBudget(modelInfo: LlmModelInfo): number {
        const reservedForOutput = this.settings.maxOutputTokens || 4096;
        const safetyMargin = this.settings.contextSafetyRatio || 0.8;
        return Math.min(
            modelInfo.contextWindow - reservedForOutput,
            Math.floor(modelInfo.contextWindow * safetyMargin),
        );
    }

    /**
     * Ensure the conversation fits within the token budget.
     * Triggers compaction if usage exceeds 80% of budget.
     */
    async ensureBudget(history: ConversationHistory): Promise<void> {
        const modelInfo = await this.provider.getModelInfo(this.settings.modelId);
        if (!modelInfo) {
            logger.warn('Could not get model info, skipping budget check');
            return;
        }

        const budget = this.getTokenBudget(modelInfo);
        const currentTokens = this.countHistoryTokens(history);

        logger.debug(`Token budget: ${currentTokens}/${budget} (${Math.round((currentTokens / budget) * 100)}%)`);

        if (currentTokens > budget * 0.8) {
            logger.info(`Context budget exceeded 80%, triggering compaction`);
            await this.compactor.compact(
                history,
                this.tokenCounter,
                this.transcriptLogger,
                this.conversationId,
            );
        }
    }

    /**
     * Build the full messages array for the LLM request.
     * Includes: system prompt + conversation history.
     */
    buildMessages(history: ConversationHistory): ChatMessage[] {
        const systemMessage: ChatMessage = {
            role: 'system',
            content: this.settings.systemPrompt,
        };
        return [systemMessage, ...history.getMessages()];
    }

    /**
     * Count total tokens in the conversation history + system prompt.
     */
    private countHistoryTokens(history: ConversationHistory): number {
        let total = this.tokenCounter.count(this.settings.systemPrompt);
        for (const msg of history.getMessages()) {
            total += 4; // role overhead
            total += this.tokenCounter.count(
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg),
            );
            if (msg.tool_calls) {
                total += this.tokenCounter.count(JSON.stringify(msg.tool_calls));
            }
        }
        total += 2; // assistant reply priming
        return total;
    }
}
