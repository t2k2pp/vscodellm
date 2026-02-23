import { describe, it, expect } from 'vitest';
import { SkillExecutor } from './SkillExecutor.js';
import type { SkillDefinition } from '../../types/skills.js';
import { SkillExecutionError } from '../../utils/errors.js';

function createSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
    return {
        name: 'test-skill',
        description: 'A test skill',
        allowedTools: [],
        body: 'Step 1: Read $0\nStep 2: Write $1',
        ...overrides,
    };
}

describe('SkillExecutor', () => {
    const executor = new SkillExecutor();

    describe('expandBody', () => {
        it('should replace positional arguments', () => {
            const skill = createSkill({ body: 'Read $0 and then edit $1' });
            const result = executor.expandBody(skill, ['file.ts', 'output.ts']);

            expect(result).toBe('Read file.ts and then edit output.ts');
        });

        it('should replace multiple occurrences of same argument', () => {
            const skill = createSkill({ body: 'Read $0 first, then check $0 again' });
            const result = executor.expandBody(skill, ['main.ts']);

            expect(result).toBe('Read main.ts first, then check main.ts again');
        });

        it('should leave unmatched placeholders as-is', () => {
            const skill = createSkill({ body: 'Read $0 and $1 and $2' });
            const result = executor.expandBody(skill, ['file.ts']);

            expect(result).toBe('Read file.ts and $1 and $2');
        });

        it('should handle no arguments', () => {
            const skill = createSkill({ body: 'Do something without args' });
            const result = executor.expandBody(skill, []);

            expect(result).toBe('Do something without args');
        });
    });

    describe('execute', () => {
        it('should return formatted prompt with skill header', () => {
            const skill = createSkill({
                name: 'my-skill',
                body: 'Do $0 with $1',
            });

            const result = executor.execute(skill, ['read', 'write']);

            expect(result).toContain('[Skill: my-skill]');
            expect(result).toContain('Do read with write');
            expect(result).toContain('User arguments: read write');
        });

        it('should omit user arguments section when no args', () => {
            const skill = createSkill({
                name: 'no-args-skill',
                body: 'Just do it',
            });

            const result = executor.execute(skill, []);

            expect(result).toContain('[Skill: no-args-skill]');
            expect(result).toContain('Just do it');
            expect(result).not.toContain('User arguments:');
        });
    });

    describe('parseInvocation', () => {
        it('should parse simple invocation', () => {
            const result = SkillExecutor.parseInvocation('create-module src/core/Foo class');

            expect(result.skillName).toBe('create-module');
            expect(result.args).toEqual(['src/core/Foo', 'class']);
        });

        it('should handle quoted arguments', () => {
            const result = SkillExecutor.parseInvocation('my-skill "arg with spaces" simple');

            expect(result.skillName).toBe('my-skill');
            expect(result.args).toEqual(['arg with spaces', 'simple']);
        });

        it('should handle single-quoted arguments', () => {
            const result = SkillExecutor.parseInvocation("my-skill 'hello world'");

            expect(result.skillName).toBe('my-skill');
            expect(result.args).toEqual(['hello world']);
        });

        it('should handle skill name only (no args)', () => {
            const result = SkillExecutor.parseInvocation('run-tests');

            expect(result.skillName).toBe('run-tests');
            expect(result.args).toEqual([]);
        });

        it('should throw on empty input', () => {
            expect(() => SkillExecutor.parseInvocation('')).toThrow(SkillExecutionError);
            expect(() => SkillExecutor.parseInvocation('   ')).toThrow(SkillExecutionError);
        });
    });
});
