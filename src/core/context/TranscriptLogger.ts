/**
 * TranscriptLogger — Appends conversation events to a JSONL file.
 *
 * Each conversation gets its own file under the transcript directory
 * (e.g. `.localllm/transcripts/{conversationId}.jsonl`).
 * Entries are written synchronously one line at a time so that
 * no data is lost even if the extension crashes.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { TranscriptEntry, TranscriptEntryType } from '../../types/transcript.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('TranscriptLogger');

export class TranscriptLogger {
    private dirEnsured = false;

    constructor(private readonly transcriptDir: string) {}

    // ============================================
    // Public convenience methods
    // ============================================

    /** Log a user message. */
    logUserMessage(conversationId: string, content: string): void {
        this.log({
            timestamp: Date.now(),
            conversationId,
            type: 'user_message',
            role: 'user',
            content,
        });
    }

    /** Log an assistant response. */
    logAssistantMessage(
        conversationId: string,
        content: string | null,
        toolCalls?: { id: string; name: string; arguments: string }[],
    ): void {
        this.log({
            timestamp: Date.now(),
            conversationId,
            type: 'assistant_message',
            role: 'assistant',
            content: content ?? undefined,
            toolCalls,
        });
    }

    /** Log a tool call (before execution). */
    logToolCall(
        conversationId: string,
        toolCallId: string,
        toolName: string,
        toolParams: Record<string, unknown>,
    ): void {
        this.log({
            timestamp: Date.now(),
            conversationId,
            type: 'tool_call',
            toolCallId,
            toolName,
            toolParams,
        });
    }

    /** Log a tool execution result. */
    logToolResult(
        conversationId: string,
        toolCallId: string,
        toolName: string,
        result: string,
        success: boolean,
    ): void {
        this.log({
            timestamp: Date.now(),
            conversationId,
            type: 'tool_result',
            toolCallId,
            toolName,
            toolResult: result,
            toolSuccess: success,
        });
    }

    /** Log a context compaction event. */
    logCompaction(conversationId: string, summary: string): void {
        this.log({
            timestamp: Date.now(),
            conversationId,
            type: 'context_compacted',
            summary,
        });
    }

    /** Log the start of an agent run. */
    logAgentStart(conversationId: string): void {
        this.log({
            timestamp: Date.now(),
            conversationId,
            type: 'agent_start',
        });
    }

    /** Log successful completion of an agent run. */
    logAgentComplete(conversationId: string, finalMessage?: string): void {
        this.log({
            timestamp: Date.now(),
            conversationId,
            type: 'agent_complete',
            content: finalMessage,
        });
    }

    /** Log an agent error. */
    logAgentError(conversationId: string, error: string): void {
        this.log({
            timestamp: Date.now(),
            conversationId,
            type: 'agent_error',
            content: error,
        });
    }

    // ============================================
    // Core write method
    // ============================================

    /** Append a single entry as one JSON line to the conversation's JSONL file. */
    log(entry: TranscriptEntry): void {
        try {
            this.ensureDir();
            const filePath = this.getTranscriptPath(entry.conversationId);
            const line = JSON.stringify(entry) + '\n';
            fs.appendFileSync(filePath, line, 'utf8');
        } catch (error) {
            // Never let logging failures break the main flow
            logger.warn(`Failed to write transcript entry: ${(error as Error).message}`);
        }
    }

    /** Get the file path for a conversation's transcript. */
    getTranscriptPath(conversationId: string): string {
        // Sanitize conversationId to be safe as a filename
        const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.transcriptDir, `${safeId}.jsonl`);
    }

    /** Get the transcript directory path. */
    getTranscriptDir(): string {
        return this.transcriptDir;
    }

    // ============================================
    // Internal
    // ============================================

    private ensureDir(): void {
        if (this.dirEnsured) return;
        if (!fs.existsSync(this.transcriptDir)) {
            fs.mkdirSync(this.transcriptDir, { recursive: true });
            logger.info(`Created transcript directory: ${this.transcriptDir}`);
        }
        this.dirEnsured = true;
    }
}
