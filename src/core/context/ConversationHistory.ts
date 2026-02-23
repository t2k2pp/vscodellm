/**
 * Manages the conversation message history for the agent loop.
 * This is the in-memory history used during a single agent run,
 * separate from the persistent display messages in StateManager.
 */

import type { ChatMessage } from '../llm/types.js';

export class ConversationHistory {
    private messages: ChatMessage[] = [];

    /** Add a message to the history. */
    addMessage(message: ChatMessage): void {
        this.messages.push(message);
    }

    /** Get all messages. */
    getMessages(): ChatMessage[] {
        return [...this.messages];
    }

    /** Get the number of messages. */
    get length(): number {
        return this.messages.length;
    }

    /**
     * Replace older messages with a summary, keeping recent ones.
     * Used by the compaction process.
     */
    replaceWithSummary(summary: string, recentMessages: ChatMessage[]): void {
        this.messages = [
            {
                role: 'system',
                content: `[Previous conversation summary]: ${summary}`,
            },
            ...recentMessages,
        ];
    }

    /** Clear all messages. */
    clear(): void {
        this.messages = [];
    }
}
