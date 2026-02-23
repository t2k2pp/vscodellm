import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubAgentTool } from './SubAgentTool.js';
import { SubAgentManager } from '../../agent/SubAgentManager.js';
import type { AgentLoopDependencies } from '../../agent/types.js';
import type { ToolContext } from '../types.js';

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

describe('SubAgentTool', () => {
    let manager: SubAgentManager;
    let tool: SubAgentTool;
    let context: ToolContext;
    let mockDeps: AgentLoopDependencies;

    beforeEach(() => {
        manager = new SubAgentManager();
        mockDeps = {} as AgentLoopDependencies;
        tool = new SubAgentTool(manager, mockDeps);
        context = createContext();

        vi.spyOn(manager, 'spawn').mockResolvedValue({
            success: true,
            output: 'Task completed successfully',
            iterationsUsed: 5,
        });
    });

    it('should have correct metadata', () => {
        expect(tool.name).toBe('spawn_subagent');
        expect(tool.requiresApproval).toBe(true);
        expect(tool.description).toContain('sub-agent');
    });

    it('should spawn a sub-agent with prompt', async () => {
        const result = await tool.execute(
            { prompt: 'Do something' },
            context,
        );

        expect(result.success).toBe(true);
        expect(result.output).toBe('Task completed successfully');
        expect(manager.spawn).toHaveBeenCalledWith(
            expect.objectContaining({ prompt: 'Do something' }),
            mockDeps,
        );
    });

    it('should pass allowed_tools and max_iterations', async () => {
        await tool.execute(
            {
                prompt: 'Test task',
                allowed_tools: ['read_file', 'search_files'],
                max_iterations: 5,
            },
            context,
        );

        expect(manager.spawn).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: 'Test task',
                allowedTools: ['read_file', 'search_files'],
                maxIterations: 5,
            }),
            mockDeps,
        );
    });

    it('should fail when prompt is missing', async () => {
        const result = await tool.execute({}, context);

        expect(result.success).toBe(false);
        expect(result.output).toContain('prompt parameter is required');
    });

    it('should handle sub-agent failure', async () => {
        vi.spyOn(manager, 'spawn').mockRejectedValue(new Error('LLM timeout'));

        const result = await tool.execute(
            { prompt: 'Failing task' },
            context,
        );

        expect(result.success).toBe(false);
        expect(result.output).toContain('Sub-agent failed');
        expect(result.output).toContain('LLM timeout');
    });

    it('should include metadata in successful result', async () => {
        const result = await tool.execute(
            { prompt: 'Success task' },
            context,
        );

        expect(result.metadata).toEqual({
            iterationsUsed: 5,
            success: true,
        });
    });
});
