import { describe, it, expect } from 'vitest';
import { PathValidator } from './PathValidator.js';

describe('PathValidator', () => {
    const validator = new PathValidator('/workspace/project');

    it('should accept paths within workspace', () => {
        const result = validator.validate('/workspace/project/src/index.ts');
        expect(result.safe).toBe(true);
        expect(result.resolvedPath).toContain('src/index.ts');
    });

    it('should accept relative paths within workspace', () => {
        const result = validator.validate('src/index.ts');
        expect(result.safe).toBe(true);
    });

    it('should reject path traversal', () => {
        const result = validator.validate('../../etc/passwd');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('traversal');
    });

    it('should reject absolute paths outside workspace', () => {
        const result = validator.validate('/etc/passwd');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('traversal');
    });

    it('should reject null bytes', () => {
        const result = validator.validate('src/\0evil.ts');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('null bytes');
    });

    it('validateOrThrow should throw for invalid paths', () => {
        expect(() => validator.validateOrThrow('../../etc/passwd')).toThrow();
    });

    it('validateOrThrow should return resolved path for valid paths', () => {
        const resolved = validator.validateOrThrow('src/index.ts');
        expect(resolved).toContain('src/index.ts');
    });
});
