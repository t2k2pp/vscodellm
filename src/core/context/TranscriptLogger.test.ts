import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { TranscriptLogger } from './TranscriptLogger.js';

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

describe('TranscriptLogger', () => {
    let logger: TranscriptLogger;
    const transcriptDir = '/workspace/.localllm/transcripts';

    beforeEach(() => {
        vi.clearAllMocks();
        mockFs.existsSync.mockReturnValue(true);
        logger = new TranscriptLogger(transcriptDir);
    });

    describe('log', () => {
        it('should append JSON line to correct file', () => {
            logger.logUserMessage('conv-123', 'Hello');

            expect(mockFs.appendFileSync).toHaveBeenCalledTimes(1);
            const [filePath, content] = mockFs.appendFileSync.mock.calls[0] as [string, string, string];
            expect(filePath).toBe(`${transcriptDir}/conv-123.jsonl`);

            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('user_message');
            expect(parsed.role).toBe('user');
            expect(parsed.content).toBe('Hello');
            expect(parsed.conversationId).toBe('conv-123');
            expect(parsed.timestamp).toBeTypeOf('number');
        });

        it('should create directory if it does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            logger = new TranscriptLogger(transcriptDir);

            logger.logUserMessage('conv-1', 'test');

            expect(mockFs.mkdirSync).toHaveBeenCalledWith(transcriptDir, { recursive: true });
        });

        it('should only create directory once', () => {
            mockFs.existsSync.mockReturnValue(false);
            logger = new TranscriptLogger(transcriptDir);

            logger.logUserMessage('conv-1', 'msg1');
            logger.logUserMessage('conv-1', 'msg2');

            expect(mockFs.mkdirSync).toHaveBeenCalledTimes(1);
        });

        it('should not throw on write errors', () => {
            mockFs.appendFileSync.mockImplementation(() => {
                throw new Error('Disk full');
            });

            expect(() => logger.logUserMessage('conv-1', 'test')).not.toThrow();
        });
    });

    describe('logAssistantMessage', () => {
        it('should log assistant text response', () => {
            logger.logAssistantMessage('conv-1', 'Hello back!');

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('assistant_message');
            expect(parsed.role).toBe('assistant');
            expect(parsed.content).toBe('Hello back!');
        });

        it('should log assistant message with tool calls', () => {
            const toolCalls = [
                { id: 'call_1', name: 'read_file', arguments: '{"path":"foo.ts"}' },
            ];
            logger.logAssistantMessage('conv-1', null, toolCalls);

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('assistant_message');
            expect(parsed.toolCalls).toHaveLength(1);
            expect(parsed.toolCalls[0].name).toBe('read_file');
            expect(parsed.content).toBeUndefined();
        });
    });

    describe('logToolCall', () => {
        it('should log tool call with params', () => {
            logger.logToolCall('conv-1', 'call_1', 'read_file', { path: 'main.ts' });

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('tool_call');
            expect(parsed.toolCallId).toBe('call_1');
            expect(parsed.toolName).toBe('read_file');
            expect(parsed.toolParams).toEqual({ path: 'main.ts' });
        });
    });

    describe('logToolResult', () => {
        it('should log successful tool result', () => {
            logger.logToolResult('conv-1', 'call_1', 'read_file', 'file contents...', true);

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('tool_result');
            expect(parsed.toolCallId).toBe('call_1');
            expect(parsed.toolName).toBe('read_file');
            expect(parsed.toolResult).toBe('file contents...');
            expect(parsed.toolSuccess).toBe(true);
        });

        it('should log failed tool result', () => {
            logger.logToolResult('conv-1', 'call_2', 'write_file', 'Permission denied', false);

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.toolSuccess).toBe(false);
        });
    });

    describe('logCompaction', () => {
        it('should log compaction event with summary', () => {
            logger.logCompaction('conv-1', 'User asked about X, assistant did Y.');

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('context_compacted');
            expect(parsed.summary).toBe('User asked about X, assistant did Y.');
        });
    });

    describe('logAgentStart / logAgentComplete / logAgentError', () => {
        it('should log agent start', () => {
            logger.logAgentStart('conv-1');

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('agent_start');
        });

        it('should log agent complete', () => {
            logger.logAgentComplete('conv-1', 'Task done');

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('agent_complete');
            expect(parsed.content).toBe('Task done');
        });

        it('should log agent error', () => {
            logger.logAgentError('conv-1', 'Something broke');

            const content = (mockFs.appendFileSync.mock.calls[0] as [string, string, string])[1];
            const parsed = JSON.parse(content.trim());
            expect(parsed.type).toBe('agent_error');
            expect(parsed.content).toBe('Something broke');
        });
    });

    describe('getTranscriptPath', () => {
        it('should return correct path for simple conversation ID', () => {
            expect(logger.getTranscriptPath('abc-123')).toBe(`${transcriptDir}/abc-123.jsonl`);
        });

        it('should sanitize unsafe characters in conversation ID', () => {
            const result = logger.getTranscriptPath('conv/../../etc');
            // Slashes and dots are replaced with underscores
            expect(result).toBe(`${transcriptDir}/conv_______etc.jsonl`);
        });

        it('should handle conversation IDs with timestamps', () => {
            const id = '1708695600000-abc123';
            expect(logger.getTranscriptPath(id)).toBe(`${transcriptDir}/1708695600000-abc123.jsonl`);
        });
    });
});
