import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubAgentManager } from './SubAgentManager.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import type { AgentLoopDependencies } from './types.js';
import type { Tool, ToolContext, ToolResult } from '../tools/types.js';

// Mock dependencies that SubAgentManager needs
vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// Mock AgentLoop to avoid needing real LLM calls
vi.mock('./AgentLoop.js', () => ({
    AgentLoop: vi.fn().mockImplementation(() => ({
        run: vi.fn().mockResolvedValue('Sub-agent completed the task'),
        cancel: vi.fn(),
        getState: vi.fn().mockReturnValue('completed'),
        getIterationCount: vi.fn().mockReturnValue(3),
    })),
}));

// Mock SystemPrompt
vi.mock('../prompts/SystemPrompt.js', () => ({
    SystemPrompt: vi.fn().mockImplementation(() => ({
        build: vi.fn().mockReturnValue('System prompt text'),
    })),
}));

// Mock ContextManager
vi.mock('../context/ContextManager.js', () => ({
    ContextManager: vi.fn().mockImplementation(() => ({})),
}));

// Simple mock tool for testing
function createMockTool(name: string): Tool {
    return {
        name,
        description: `Mock tool ${name}`,
        parameterSchema: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: vi.fn().mockResolvedValue({ success: true, output: 'ok' }),
    };
}

function createMockDeps(): AgentLoopDependencies {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register(createMockTool('read_file'));
    toolRegistry.register(createMockTool('write_file'));
    toolRegistry.register(createMockTool('search_files'));

    return {
        provider: {
            id: 'test',
            name: 'Test Provider',
            testConnection: vi.fn(),
            listModels: vi.fn(),
            streamCompletion: vi.fn(),
            complete: vi.fn(),
            countTokens: vi.fn().mockReturnValue(10),
            getModelInfo: vi.fn(),
            dispose: vi.fn(),
        } as any,
        toolExecutor: {} as any,
        toolRegistry,
        contextManager: {} as any,
        conversationHistory: {} as any,
        approvalService: {} as any,
        workspaceRoot: '/workspace',
        settings: {
            maxIterations: 25,
            temperature: 0,
            maxOutputTokens: 4096,
            modelId: 'test-model',
            preferNativeToolCalling: true,
        },
        onStateChange: { fire: vi.fn() },
        onStreamChunk: { fire: vi.fn() },
        onToolCall: { fire: vi.fn() },
        onError: { fire: vi.fn() },
    };
}

describe('SubAgentManager', () => {
    let manager: SubAgentManager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new SubAgentManager();
    });

    it('should spawn a sub-agent and return result', async () => {
        const deps = createMockDeps();

        const result = await manager.spawn(
            { prompt: 'Do something useful' },
            deps,
        );

        expect(result.success).toBe(true);
        expect(result.output).toBe('Sub-agent completed the task');
        expect(result.iterationsUsed).toBe(3);
    });

    it('should use default maxIterations of 10', async () => {
        const { AgentLoop } = await import('./AgentLoop.js');
        const deps = createMockDeps();

        await manager.spawn({ prompt: 'test' }, deps);

        expect(AgentLoop).toHaveBeenCalledWith(
            expect.objectContaining({
                settings: expect.objectContaining({
                    maxIterations: 10,
                }),
            }),
        );
    });

    it('should use custom maxIterations', async () => {
        const { AgentLoop } = await import('./AgentLoop.js');
        const deps = createMockDeps();

        await manager.spawn({ prompt: 'test', maxIterations: 5 }, deps);

        expect(AgentLoop).toHaveBeenCalledWith(
            expect.objectContaining({
                settings: expect.objectContaining({
                    maxIterations: 5,
                }),
            }),
        );
    });

    it('should filter tools when allowedTools specified', async () => {
        const { AgentLoop } = await import('./AgentLoop.js');
        const deps = createMockDeps();

        await manager.spawn(
            { prompt: 'test', allowedTools: ['read_file'] },
            deps,
        );

        const call = (AgentLoop as any).mock.calls[0][0];
        const registry = call.toolRegistry as ToolRegistry;
        expect(registry.getNames()).toEqual(['read_file']);
    });

    it('should track active sub-agents', async () => {
        const deps = createMockDeps();

        expect(manager.activeCount).toBe(0);

        // After spawn completes, count should be back to 0
        await manager.spawn({ prompt: 'test' }, deps);
        expect(manager.activeCount).toBe(0);
    });

    it('should cancelAll active sub-agents', () => {
        // Just verify the method exists and doesn't throw
        manager.cancelAll();
        expect(manager.activeCount).toBe(0);
    });
});
