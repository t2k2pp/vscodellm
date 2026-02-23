import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { TranscriptSearcher } from './TranscriptSearcher.js';
import type { TranscriptEntry } from '../../types/transcript.js';

vi.mock('fs');
vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

const mockFs = vi.mocked(fs);

/** Helper to build a JSONL file content from entries. */
function toJsonl(entries: TranscriptEntry[]): string {
    return entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

describe('TranscriptSearcher', () => {
    let searcher: TranscriptSearcher;
    const transcriptDir = '/workspace/.localllm/transcripts';

    beforeEach(() => {
        vi.clearAllMocks();
        searcher = new TranscriptSearcher(transcriptDir);
    });

    const sampleEntries: TranscriptEntry[] = [
        {
            timestamp: 1000,
            conversationId: 'conv-1',
            type: 'user_message',
            role: 'user',
            content: 'Please read the main.ts file',
        },
        {
            timestamp: 2000,
            conversationId: 'conv-1',
            type: 'assistant_message',
            role: 'assistant',
            content: 'I will read main.ts for you.',
            toolCalls: [{ id: 'call_1', name: 'read_file', arguments: '{"path":"main.ts"}' }],
        },
        {
            timestamp: 3000,
            conversationId: 'conv-1',
            type: 'tool_result',
            toolCallId: 'call_1',
            toolName: 'read_file',
            toolResult: 'console.log("hello world");',
            toolSuccess: true,
        },
        {
            timestamp: 4000,
            conversationId: 'conv-1',
            type: 'assistant_message',
            role: 'assistant',
            content: 'The file contains a simple hello world program.',
        },
        {
            timestamp: 5000,
            conversationId: 'conv-1',
            type: 'context_compacted',
            summary: 'User asked to read main.ts. File contained hello world.',
        },
    ];

    describe('search', () => {
        it('should find entries matching query', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const results = searcher.search('conv-1', 'main.ts');

            expect(results.length).toBeGreaterThan(0);
            // Should match user message and assistant message
            expect(results.some((r) => r.entry.type === 'user_message')).toBe(true);
        });

        it('should return empty array for non-existent transcript', () => {
            mockFs.existsSync.mockReturnValue(false);

            const results = searcher.search('nonexistent', 'query');

            expect(results).toEqual([]);
        });

        it('should respect maxResults option', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const results = searcher.search('conv-1', 'main', { maxResults: 1 });

            expect(results).toHaveLength(1);
        });

        it('should filter by entry types', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const results = searcher.search('conv-1', 'main', {
                entryTypes: ['user_message'],
            });

            expect(results.length).toBeGreaterThan(0);
            expect(results.every((r) => r.entry.type === 'user_message')).toBe(true);
        });

        it('should search tool results', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const results = searcher.search('conv-1', 'hello world');

            expect(results.some((r) => r.entry.type === 'tool_result')).toBe(true);
        });

        it('should search compaction summaries', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const results = searcher.search('conv-1', 'hello world');

            expect(results.some((r) => r.entry.type === 'context_compacted')).toBe(true);
        });

        it('should handle regex patterns', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const results = searcher.search('conv-1', 'console\\.log');

            expect(results).toHaveLength(1);
            expect(results[0].entry.type).toBe('tool_result');
        });

        it('should handle invalid regex by escaping', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            // Invalid regex should be escaped and used as literal
            const results = searcher.search('conv-1', '[invalid');

            expect(results).toEqual([]);
        });

        it('should skip malformed JSON lines', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(
                'not json\n' + JSON.stringify(sampleEntries[0]) + '\n',
            );

            const results = searcher.search('conv-1', 'main');

            expect(results).toHaveLength(1);
        });

        it('should include line numbers in results', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const results = searcher.search('conv-1', 'hello world');

            // Line numbers are 1-based
            expect(results.every((r) => r.lineNumber >= 1)).toBe(true);
        });
    });

    describe('searchAll', () => {
        it('should search across multiple transcripts', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue(['conv-1.jsonl', 'conv-2.jsonl'] as any);
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 1000,
                mtimeMs: Date.now(),
            } as fs.Stats);
            mockFs.readFileSync.mockReturnValue(toJsonl([sampleEntries[0]]));

            const results = searcher.searchAll('main.ts');

            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('getRecentEntries', () => {
        it('should return last N entries', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const entries = searcher.getRecentEntries('conv-1', 2);

            expect(entries).toHaveLength(2);
            // Should be the last two entries
            expect(entries[0].type).toBe('assistant_message');
            expect(entries[1].type).toBe('context_compacted');
        });

        it('should return all entries if fewer than count', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(toJsonl(sampleEntries));

            const entries = searcher.getRecentEntries('conv-1', 100);

            expect(entries).toHaveLength(5);
        });

        it('should return empty array for non-existent transcript', () => {
            mockFs.existsSync.mockReturnValue(false);

            const entries = searcher.getRecentEntries('nonexistent', 5);

            expect(entries).toEqual([]);
        });
    });

    describe('listTranscripts', () => {
        it('should list all JSONL files sorted by modification time', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue(['conv-1.jsonl', 'conv-2.jsonl', 'readme.txt'] as any);
            mockFs.statSync.mockImplementation((p: fs.PathLike) => {
                const s = String(p);
                if (s.endsWith('conv-1.jsonl')) {
                    return { isFile: () => true, size: 500, mtimeMs: 1000 } as fs.Stats;
                }
                if (s.endsWith('conv-2.jsonl')) {
                    return { isFile: () => true, size: 1200, mtimeMs: 2000 } as fs.Stats;
                }
                return { isFile: () => true, size: 10, mtimeMs: 3000 } as fs.Stats;
            });

            const transcripts = searcher.listTranscripts();

            // Only .jsonl files
            expect(transcripts).toHaveLength(2);
            // Sorted by modifiedAt descending (most recent first)
            expect(transcripts[0].conversationId).toBe('conv-2');
            expect(transcripts[1].conversationId).toBe('conv-1');
            expect(transcripts[0].size).toBe(1200);
        });

        it('should return empty array if directory does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            const transcripts = searcher.listTranscripts();

            expect(transcripts).toEqual([]);
        });
    });
});
