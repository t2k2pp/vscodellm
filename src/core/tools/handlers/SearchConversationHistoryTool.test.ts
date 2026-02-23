import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchConversationHistoryTool } from './SearchConversationHistoryTool.js';
import type { TranscriptSearcher } from '../../context/TranscriptSearcher.js';
import type { TranscriptSearchResult } from '../../../types/transcript.js';
import type { ToolContext } from '../types.js';

vi.mock('../../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

function createMockSearcher(): TranscriptSearcher {
    return {
        search: vi.fn().mockReturnValue([]),
        searchAll: vi.fn().mockReturnValue([]),
        getRecentEntries: vi.fn().mockReturnValue([]),
        listTranscripts: vi.fn().mockReturnValue([]),
    } as unknown as TranscriptSearcher;
}

function createMockContext(): ToolContext {
    return {
        workspaceRoot: '/workspace',
        abortSignal: new AbortController().signal,
        approvalService: {} as any,
        onProgress: vi.fn(),
    };
}

describe('SearchConversationHistoryTool', () => {
    let tool: SearchConversationHistoryTool;
    let mockSearcher: TranscriptSearcher;
    let context: ToolContext;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSearcher = createMockSearcher();
        tool = new SearchConversationHistoryTool(mockSearcher, 'current-conv');
        context = createMockContext();
    });

    it('should have correct tool metadata', () => {
        expect(tool.name).toBe('search_conversation_history');
        expect(tool.requiresApproval).toBe(false);
    });

    it('should search current conversation by default', async () => {
        const result = await tool.execute({ query: 'main.ts' }, context);

        expect(mockSearcher.search).toHaveBeenCalledWith('current-conv', 'main.ts', {
            maxResults: 20,
            entryTypes: undefined,
        });
        expect(result.success).toBe(true);
    });

    it('should use provided conversation_id', async () => {
        const result = await tool.execute(
            { query: 'test', conversation_id: 'other-conv' },
            context,
        );

        expect(mockSearcher.search).toHaveBeenCalledWith('other-conv', 'test', expect.any(Object));
        expect(result.success).toBe(true);
    });

    it('should pass options to searcher', async () => {
        await tool.execute(
            {
                query: 'test',
                max_results: 5,
                entry_types: ['user_message', 'tool_result'],
            },
            context,
        );

        expect(mockSearcher.search).toHaveBeenCalledWith('current-conv', 'test', {
            maxResults: 5,
            entryTypes: ['user_message', 'tool_result'],
        });
    });

    it('should return formatted results when matches found', async () => {
        const searchResults: TranscriptSearchResult[] = [
            {
                entry: {
                    timestamp: 1708695600000,
                    conversationId: 'current-conv',
                    type: 'user_message',
                    role: 'user',
                    content: 'Please read main.ts',
                },
                lineNumber: 1,
                matchedText: 'read main.ts',
            },
            {
                entry: {
                    timestamp: 1708695601000,
                    conversationId: 'current-conv',
                    type: 'tool_result',
                    toolCallId: 'call_1',
                    toolName: 'read_file',
                    toolResult: 'contents of main.ts...',
                    toolSuccess: true,
                },
                lineNumber: 3,
                matchedText: 'main.ts',
            },
        ];
        vi.mocked(mockSearcher.search).mockReturnValue(searchResults);

        const result = await tool.execute({ query: 'main.ts' }, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('Found 2 matches');
        expect(result.output).toContain('user_message');
        expect(result.output).toContain('tool_result');
        expect(result.output).toContain('read_file');
        expect(result.output).toContain('Please read main.ts');
    });

    it('should report no matches', async () => {
        vi.mocked(mockSearcher.search).mockReturnValue([]);

        const result = await tool.execute({ query: 'nonexistent' }, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('No matches found');
    });

    it('should return error for empty query', async () => {
        const result = await tool.execute({ query: '' }, context);

        expect(result.success).toBe(false);
        expect(result.output).toContain('query parameter is required');
    });

    it('should return error when no conversation ID available', async () => {
        tool = new SearchConversationHistoryTool(mockSearcher, '');

        const result = await tool.execute({ query: 'test' }, context);

        expect(result.success).toBe(false);
        expect(result.output).toContain('No conversation ID');
    });

    it('should handle search errors gracefully', async () => {
        vi.mocked(mockSearcher.search).mockImplementation(() => {
            throw new Error('Read error');
        });

        const result = await tool.execute({ query: 'test' }, context);

        expect(result.success).toBe(false);
        expect(result.output).toContain('Search failed');
    });

    it('should update current conversation ID', async () => {
        tool.setCurrentConversationId('new-conv-id');

        await tool.execute({ query: 'test' }, context);

        expect(mockSearcher.search).toHaveBeenCalledWith('new-conv-id', 'test', expect.any(Object));
    });

    it('should format assistant messages with tool calls', async () => {
        const searchResults: TranscriptSearchResult[] = [
            {
                entry: {
                    timestamp: 1708695600000,
                    conversationId: 'current-conv',
                    type: 'assistant_message',
                    role: 'assistant',
                    content: 'Let me check that.',
                    toolCalls: [
                        { id: 'call_1', name: 'read_file', arguments: '{"path":"foo.ts"}' },
                        { id: 'call_2', name: 'search_files', arguments: '{"pattern":"bar"}' },
                    ],
                },
                lineNumber: 2,
                matchedText: 'check',
            },
        ];
        vi.mocked(mockSearcher.search).mockReturnValue(searchResults);

        const result = await tool.execute({ query: 'check' }, context);

        expect(result.output).toContain('assistant_message');
        expect(result.output).toContain('Let me check that.');
        expect(result.output).toContain('read_file, search_files');
    });
});
