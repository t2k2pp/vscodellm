import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvokeSkillTool } from './InvokeSkillTool.js';
import { SkillRegistry } from '../../skills/SkillRegistry.js';
import type { SkillDefinition } from '../../../types/skills.js';
import type { ToolContext } from '../types.js';

function createSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
    return {
        name: 'test-skill',
        description: 'A test skill',
        allowedTools: [],
        body: 'Read $0 and do stuff',
        ...overrides,
    };
}

function createContext(): ToolContext {
    return {
        workspaceRoot: '/workspace',
        abortSignal: new AbortController().signal,
        approvalService: {} as any,
        onProgress: vi.fn(),
    };
}

describe('InvokeSkillTool', () => {
    let registry: SkillRegistry;
    let tool: InvokeSkillTool;
    let context: ToolContext;

    beforeEach(() => {
        registry = new SkillRegistry();
        tool = new InvokeSkillTool(registry);
        context = createContext();
    });

    it('should have correct metadata', () => {
        expect(tool.name).toBe('invoke_skill');
        expect(tool.requiresApproval).toBe(false);
        expect(tool.description).toContain('skill');
    });

    it('should execute a skill successfully', async () => {
        registry.register(createSkill({ name: 'my-skill', body: 'Do $0' }));

        const result = await tool.execute(
            { skill_name: 'my-skill', arguments: 'hello' },
            context,
        );

        expect(result.success).toBe(true);
        expect(result.output).toContain('[Skill: my-skill]');
        expect(result.output).toContain('Do hello');
    });

    it('should fail when skill_name is missing', async () => {
        const result = await tool.execute({}, context);

        expect(result.success).toBe(false);
        expect(result.output).toContain('skill_name parameter is required');
    });

    it('should fail when skill not found', async () => {
        const result = await tool.execute(
            { skill_name: 'nonexistent' },
            context,
        );

        expect(result.success).toBe(false);
        expect(result.output).toContain('not found');
    });

    it('should list available skills when skill not found', async () => {
        registry.register(createSkill({ name: 'skill-a' }));
        registry.register(createSkill({ name: 'skill-b' }));

        const result = await tool.execute(
            { skill_name: 'unknown' },
            context,
        );

        expect(result.success).toBe(false);
        expect(result.output).toContain('skill-a');
        expect(result.output).toContain('skill-b');
    });

    it('should handle skill with no arguments', async () => {
        registry.register(createSkill({ name: 'no-args', body: 'Just do it' }));

        const result = await tool.execute(
            { skill_name: 'no-args' },
            context,
        );

        expect(result.success).toBe(true);
        expect(result.output).toContain('Just do it');
    });

    it('should handle skill with multiple arguments', async () => {
        registry.register(createSkill({
            name: 'multi-arg',
            body: 'Path: $0, Type: $1',
        }));

        const result = await tool.execute(
            { skill_name: 'multi-arg', arguments: 'src/core/Foo class' },
            context,
        );

        expect(result.success).toBe(true);
        expect(result.output).toContain('Path: src/core/Foo, Type: class');
    });
});
