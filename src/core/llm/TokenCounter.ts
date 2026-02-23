/**
 * Token counting utility.
 *
 * Uses gpt-tokenizer (cl100k_base encoding) as an approximation for
 * token counts across local LLM models. While local models use different
 * tokenizers, cl100k_base provides a reasonable approximation that
 * consistently overestimates slightly, which is safe for context
 * budget calculations.
 *
 * Singleton pattern is used because the tokenizer initialization
 * loads BPE rank data, so we only want to do it once.
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import { encode } from 'gpt-tokenizer';
import type { ChatMessage } from './types.js';

/**
 * Overhead tokens per message in the chat format.
 * OpenAI uses ~4 tokens per message for role/formatting metadata.
 */
const MESSAGE_OVERHEAD_TOKENS = 4;

/**
 * Tokens added at the end for the assistant reply priming.
 * The model uses ~2 tokens as a "preamble" for generating the response.
 */
const REPLY_PRIMING_TOKENS = 2;

export class TokenCounter {
    private static _instance: TokenCounter | undefined;

    private constructor() {
        // Private constructor for singleton pattern.
        // The gpt-tokenizer module loads its BPE data on first use,
        // so we don't need explicit initialization here.
    }

    /**
     * Get the singleton TokenCounter instance.
     */
    static getInstance(): TokenCounter {
        if (!TokenCounter._instance) {
            TokenCounter._instance = new TokenCounter();
        }
        return TokenCounter._instance;
    }

    /**
     * Count the approximate number of tokens in the given text.
     *
     * Uses the cl100k_base encoding (GPT-4 tokenizer) which provides
     * a reasonable approximation for most local LLM tokenizers.
     *
     * @param text - The text to tokenize
     * @returns Approximate token count
     */
    count(text: string): number {
        if (!text) {
            return 0;
        }

        try {
            const tokens = encode(text);
            return tokens.length;
        } catch {
            // Fallback: rough estimation at ~4 chars per token
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Count the approximate total tokens for an array of chat messages.
     *
     * Accounts for:
     * - The content of each message
     * - Per-message overhead (~4 tokens for role/formatting per OpenAI's scheme)
     * - Reply priming tokens (~2 tokens for the assistant response header)
     * - Tool call arguments in assistant messages
     * - Tool call IDs in tool result messages
     *
     * @param messages - Array of ChatMessage objects
     * @returns Approximate total token count
     */
    countMessages(messages: ChatMessage[]): number {
        let total = 0;

        for (const message of messages) {
            // Per-message overhead (role name + formatting separators)
            total += MESSAGE_OVERHEAD_TOKENS;

            // Message content
            if (message.content) {
                total += this.count(message.content);
            }

            // Tool calls in assistant messages
            if (message.tool_calls) {
                for (const toolCall of message.tool_calls) {
                    // Function name
                    total += this.count(toolCall.function.name);
                    // Function arguments (JSON string)
                    total += this.count(toolCall.function.arguments);
                    // Overhead for tool call structure
                    total += 3;
                }
            }

            // Tool call ID in tool response messages
            if (message.tool_call_id) {
                total += this.count(message.tool_call_id);
            }
        }

        // Reply priming tokens
        total += REPLY_PRIMING_TOKENS;

        return total;
    }

    /**
     * Check if a text fits within a token budget.
     *
     * @param text - The text to check
     * @param maxTokens - Maximum allowed tokens
     * @returns true if the text fits, false otherwise
     */
    isWithinLimit(text: string, maxTokens: number): boolean {
        return this.count(text) <= maxTokens;
    }

    /**
     * Truncate text to fit within a token budget.
     * Uses a binary search approach for efficiency.
     *
     * @param text - The text to truncate
     * @param maxTokens - Maximum allowed tokens
     * @param suffix - Optional suffix to append when truncated (e.g., "... [truncated]")
     * @returns The truncated text
     */
    truncateToFit(text: string, maxTokens: number, suffix = '... [truncated]'): string {
        if (this.count(text) <= maxTokens) {
            return text;
        }

        const suffixTokens = suffix ? this.count(suffix) : 0;
        const targetTokens = maxTokens - suffixTokens;

        if (targetTokens <= 0) {
            return suffix;
        }

        // Binary search for the right character position
        let low = 0;
        let high = text.length;

        while (low < high) {
            const mid = Math.floor((low + high + 1) / 2);
            if (this.count(text.slice(0, mid)) <= targetTokens) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        return text.slice(0, low) + suffix;
    }
}
