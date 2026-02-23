import { describe, it, expect } from 'vitest';
import { ToolValidator } from './ToolValidator.js';
import type { Tool, ToolContext, ToolResult } from './types.js';

// Minimal mock tool
const mockTool: Tool = {
    name: 'test_tool',
    description: 'A test tool',
    requiresApproval: false,
    parameterSchema: {
        type: 'object',
        properties: {
            path: { type: 'string' },
            count: { type: 'number' },
            active: { type: 'boolean' },
        },
        required: ['path'],
    },
    execute: async () => ({ success: true, output: 'ok' }),
};

describe('ToolValidator', () => {
    const validator = new ToolValidator();

    it('should validate correct parameters', () => {
        const result = validator.validate(mockTool, { path: '/foo/bar', count: 5 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required parameters', () => {
        const result = validator.validate(mockTool, { count: 5 });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('path');
    });

    it('should reject wrong types', () => {
        const result = validator.validate(mockTool, { path: 123 });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('string');
    });

    it('should accept extra properties', () => {
        const result = validator.validate(mockTool, { path: '/foo', extra: 'bar' });
        expect(result.valid).toBe(true);
    });

    it('should validate boolean types', () => {
        const result = validator.validate(mockTool, { path: '/foo', active: 'not-bool' });
        expect(result.valid).toBe(false);
    });
});
