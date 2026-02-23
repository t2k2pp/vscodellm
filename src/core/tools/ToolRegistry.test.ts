import { describe, it, expect } from 'vitest';
import { ToolRegistry } from './ToolRegistry.js';
import type { Tool } from './types.js';

const makeTool = (name: string): Tool => ({
    name,
    description: `Tool ${name}`,
    requiresApproval: false,
    parameterSchema: { type: 'object', properties: {} },
    execute: async () => ({ success: true, output: 'ok' }),
});

describe('ToolRegistry', () => {
    it('should register and retrieve tools', () => {
        const registry = new ToolRegistry();
        const tool = makeTool('my_tool');
        registry.register(tool);

        expect(registry.get('my_tool')).toBe(tool);
        expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should list all tools', () => {
        const registry = new ToolRegistry();
        registry.register(makeTool('tool_a'));
        registry.register(makeTool('tool_b'));

        expect(registry.getAll()).toHaveLength(2);
    });

    it('should generate OpenAI tool definitions', () => {
        const registry = new ToolRegistry();
        registry.register(makeTool('read_file'));

        const defs = registry.getToolDefinitions();
        expect(defs).toHaveLength(1);
        expect(defs[0].type).toBe('function');
        expect(defs[0].function.name).toBe('read_file');
    });

    it('should generate XML tool descriptions', () => {
        const registry = new ToolRegistry();
        registry.register(makeTool('read_file'));

        const xml = registry.getToolDescriptions();
        expect(xml).toContain('<tool name="read_file">');
        expect(xml).toContain('<description>');
    });
});
