import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpTool, createMcpTools, parseMcpToolName } from './McpToolAdapter.js';
import { McpClient } from './McpClient.js';
import type { McpToolDefinition, McpToolCallResult } from './types.js';
import type { ToolContext } from '../tools/types.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

function createContext(): ToolContext {
    return {
        workspaceRoot: '/workspace',
        abortSignal: new AbortController().signal,
        approvalService: {} as any,
        onProgress: vi.fn(),
    };
}

describe('McpToolAdapter', () => {
    describe('createMcpTool', () => {
        it('should create a Tool with qualified name', () => {
            const toolDef: McpToolDefinition = {
                name: 'search',
                description: 'Search for things',
                inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                },
            };

            const mockClient = {} as McpClient;
            const tool = createMcpTool('myserver', toolDef, mockClient);

            expect(tool.name).toBe('myserver__search');
            expect(tool.description).toContain('[MCP:myserver]');
            expect(tool.description).toContain('Search for things');
            expect(tool.requiresApproval).toBe(true);
            expect(tool.parameterSchema).toBe(toolDef.inputSchema);
        });

        it('should execute by calling McpClient.callTool', async () => {
            const toolDef: McpToolDefinition = {
                name: 'echo',
                description: 'Echo tool',
                inputSchema: { type: 'object', properties: {} },
            };

            const callResult: McpToolCallResult = {
                content: [{ type: 'text', text: 'Hello World' }],
                isError: false,
            };

            const mockClient = {
                callTool: vi.fn().mockResolvedValue(callResult),
            } as unknown as McpClient;

            const tool = createMcpTool('srv', toolDef, mockClient);
            const result = await tool.execute({ message: 'hi' }, createContext());

            expect(result.success).toBe(true);
            expect(result.output).toBe('Hello World');
            expect(mockClient.callTool).toHaveBeenCalledWith('echo', { message: 'hi' });
        });

        it('should handle error results from MCP', async () => {
            const toolDef: McpToolDefinition = {
                name: 'fail',
                description: 'Failing tool',
                inputSchema: { type: 'object', properties: {} },
            };

            const callResult: McpToolCallResult = {
                content: [{ type: 'text', text: 'Something went wrong' }],
                isError: true,
            };

            const mockClient = {
                callTool: vi.fn().mockResolvedValue(callResult),
            } as unknown as McpClient;

            const tool = createMcpTool('srv', toolDef, mockClient);
            const result = await tool.execute({}, createContext());

            expect(result.success).toBe(false);
            expect(result.output).toBe('Something went wrong');
        });

        it('should join multiple text content items', async () => {
            const toolDef: McpToolDefinition = {
                name: 'multi',
                description: 'Multi output',
                inputSchema: { type: 'object', properties: {} },
            };

            const callResult: McpToolCallResult = {
                content: [
                    { type: 'text', text: 'Line 1' },
                    { type: 'text', text: 'Line 2' },
                    { type: 'image', data: 'base64data' },
                ],
            };

            const mockClient = {
                callTool: vi.fn().mockResolvedValue(callResult),
            } as unknown as McpClient;

            const tool = createMcpTool('srv', toolDef, mockClient);
            const result = await tool.execute({}, createContext());

            expect(result.output).toBe('Line 1\nLine 2');
        });
    });

    describe('createMcpTools', () => {
        it('should create multiple Tool instances', () => {
            const toolDefs: McpToolDefinition[] = [
                { name: 'tool-a', description: 'A', inputSchema: {} },
                { name: 'tool-b', description: 'B', inputSchema: {} },
            ];

            const mockClient = {} as McpClient;
            const tools = createMcpTools('srv', toolDefs, mockClient);

            expect(tools).toHaveLength(2);
            expect(tools[0].name).toBe('srv__tool-a');
            expect(tools[1].name).toBe('srv__tool-b');
        });
    });

    describe('parseMcpToolName', () => {
        it('should parse qualified name', () => {
            const result = parseMcpToolName('myserver__search');
            expect(result).toEqual({ serverName: 'myserver', toolName: 'search' });
        });

        it('should return null for non-MCP names', () => {
            expect(parseMcpToolName('read_file')).toBeNull();
            expect(parseMcpToolName('simple')).toBeNull();
        });

        it('should handle multiple separators', () => {
            const result = parseMcpToolName('server__tool__extra');
            expect(result).toEqual({ serverName: 'server', toolName: 'tool__extra' });
        });
    });
});
