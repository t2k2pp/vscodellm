/**
 * TranscriptSearcher — Searches JSONL transcript files.
 *
 * Reads conversation transcript files line-by-line and returns
 * entries that match a query string or regular expression.
 * This enables the agent to recover details that were lost
 * during context compaction.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
    TranscriptEntry,
    TranscriptSearchOptions,
    TranscriptSearchResult,
    TranscriptInfo,
} from '../../types/transcript.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('TranscriptSearcher');

const DEFAULT_MAX_RESULTS = 20;

export class TranscriptSearcher {
    constructor(private readonly transcriptDir: string) {}

    /**
     * Search a single conversation's transcript for entries matching `query`.
     * The query is treated as a case-insensitive regular expression.
     */
    search(
        conversationId: string,
        query: string,
        options?: TranscriptSearchOptions,
    ): TranscriptSearchResult[] {
        const filePath = this.getTranscriptPath(conversationId);
        if (!fs.existsSync(filePath)) {
            return [];
        }

        const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
        const entryTypes = options?.entryTypes;

        let regex: RegExp;
        try {
            regex = new RegExp(query, 'i');
        } catch {
            // If the query is not valid regex, escape and use as literal
            regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        }

        const results: TranscriptSearchResult[] = [];
        const lines = fs.readFileSync(filePath, 'utf8').split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) break;

            const line = lines[i].trim();
            if (!line) continue;

            let entry: TranscriptEntry;
            try {
                entry = JSON.parse(line) as TranscriptEntry;
            } catch {
                continue; // Skip malformed lines
            }

            // Type filter
            if (entryTypes && entryTypes.length > 0 && !entryTypes.includes(entry.type)) {
                continue;
            }

            // Search across all text-bearing fields
            const searchableText = this.getSearchableText(entry);
            const match = regex.exec(searchableText);
            if (match) {
                results.push({
                    entry,
                    lineNumber: i + 1,
                    matchedText: this.extractContext(searchableText, match.index, 100),
                });
            }
        }

        return results;
    }

    /**
     * Search across ALL conversation transcripts.
     */
    searchAll(query: string, options?: TranscriptSearchOptions): TranscriptSearchResult[] {
        const transcripts = this.listTranscripts();
        const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
        const allResults: TranscriptSearchResult[] = [];

        for (const info of transcripts) {
            if (allResults.length >= maxResults) break;

            const remaining = maxResults - allResults.length;
            const results = this.search(info.conversationId, query, {
                ...options,
                maxResults: remaining,
            });
            allResults.push(...results);
        }

        return allResults;
    }

    /**
     * Get the last N entries from a conversation transcript.
     * Useful for recovering recent context after compaction.
     */
    getRecentEntries(conversationId: string, count: number): TranscriptEntry[] {
        const filePath = this.getTranscriptPath(conversationId);
        if (!fs.existsSync(filePath)) {
            return [];
        }

        const lines = fs.readFileSync(filePath, 'utf8').split('\n');
        const entries: TranscriptEntry[] = [];

        // Read from the end
        for (let i = lines.length - 1; i >= 0 && entries.length < count; i--) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                entries.unshift(JSON.parse(line) as TranscriptEntry);
            } catch {
                continue;
            }
        }

        return entries;
    }

    /**
     * List all available transcript files with metadata.
     */
    listTranscripts(): TranscriptInfo[] {
        if (!fs.existsSync(this.transcriptDir)) {
            return [];
        }

        try {
            const files = fs.readdirSync(this.transcriptDir);
            const infos: TranscriptInfo[] = [];

            for (const file of files) {
                if (!file.endsWith('.jsonl')) continue;

                const fullPath = path.join(this.transcriptDir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (!stat.isFile()) continue;

                    infos.push({
                        conversationId: file.replace(/\.jsonl$/, ''),
                        size: stat.size,
                        modifiedAt: stat.mtimeMs,
                    });
                } catch {
                    continue;
                }
            }

            // Most recently modified first
            return infos.sort((a, b) => b.modifiedAt - a.modifiedAt);
        } catch (error) {
            logger.warn(`Failed to list transcripts: ${(error as Error).message}`);
            return [];
        }
    }

    // ============================================
    // Internal helpers
    // ============================================

    private getTranscriptPath(conversationId: string): string {
        const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.transcriptDir, `${safeId}.jsonl`);
    }

    /**
     * Build a searchable string from all text-bearing fields of an entry.
     */
    private getSearchableText(entry: TranscriptEntry): string {
        const parts: string[] = [];

        if (entry.content) parts.push(entry.content);
        if (entry.summary) parts.push(entry.summary);
        if (entry.toolName) parts.push(entry.toolName);
        if (entry.toolResult) parts.push(entry.toolResult);
        if (entry.toolParams) parts.push(JSON.stringify(entry.toolParams));
        if (entry.toolCalls) {
            for (const tc of entry.toolCalls) {
                parts.push(tc.name);
                parts.push(tc.arguments);
            }
        }

        return parts.join(' ');
    }

    /**
     * Extract a snippet of text around the match position.
     */
    private extractContext(text: string, matchIndex: number, contextLen: number): string {
        const start = Math.max(0, matchIndex - contextLen / 2);
        const end = Math.min(text.length, matchIndex + contextLen / 2);
        let snippet = text.slice(start, end);

        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';

        return snippet;
    }
}
