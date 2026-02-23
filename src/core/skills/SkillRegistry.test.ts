import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from './SkillRegistry.js';
import type { SkillDefinition } from '../../types/skills.js';

function createSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
    return {
        name: 'test-skill',
        description: 'A test skill',
        allowedTools: [],
        body: 'Do something',
        ...overrides,
    };
}

describe('SkillRegistry', () => {
    let registry: SkillRegistry;

    beforeEach(() => {
        registry = new SkillRegistry();
    });

    it('should register and retrieve a skill', () => {
        const skill = createSkill({ name: 'my-skill' });
        registry.register(skill);

        expect(registry.get('my-skill')).toBe(skill);
        expect(registry.has('my-skill')).toBe(true);
        expect(registry.size).toBe(1);
    });

    it('should return undefined for unknown skills', () => {
        expect(registry.get('nonexistent')).toBeUndefined();
        expect(registry.has('nonexistent')).toBe(false);
    });

    it('should register multiple skills at once', () => {
        const skills = [
            createSkill({ name: 'skill-1' }),
            createSkill({ name: 'skill-2' }),
            createSkill({ name: 'skill-3' }),
        ];
        registry.registerAll(skills);

        expect(registry.size).toBe(3);
        expect(registry.getNames()).toEqual(['skill-1', 'skill-2', 'skill-3']);
    });

    it('should unregister a skill', () => {
        registry.register(createSkill({ name: 'to-remove' }));
        expect(registry.has('to-remove')).toBe(true);

        const removed = registry.unregister('to-remove');
        expect(removed).toBe(true);
        expect(registry.has('to-remove')).toBe(false);
    });

    it('should return false when unregistering nonexistent skill', () => {
        expect(registry.unregister('nonexistent')).toBe(false);
    });

    it('should clear all skills', () => {
        registry.registerAll([
            createSkill({ name: 's1' }),
            createSkill({ name: 's2' }),
        ]);
        expect(registry.size).toBe(2);

        registry.clear();
        expect(registry.size).toBe(0);
        expect(registry.getAll()).toEqual([]);
    });

    it('should getAll skills', () => {
        const s1 = createSkill({ name: 'alpha' });
        const s2 = createSkill({ name: 'beta' });
        registry.register(s1);
        registry.register(s2);

        const all = registry.getAll();
        expect(all).toHaveLength(2);
        expect(all).toContain(s1);
        expect(all).toContain(s2);
    });

    describe('getSkillListDescription', () => {
        it('should return empty string when no skills registered', () => {
            expect(registry.getSkillListDescription()).toBe('');
        });

        it('should generate LLM-friendly skill list', () => {
            registry.register(
                createSkill({
                    name: 'create-module',
                    description: 'Create a TypeScript module',
                    argumentHint: '[path] [type]',
                }),
            );
            registry.register(
                createSkill({
                    name: 'run-tests',
                    description: 'Run all tests',
                }),
            );

            const desc = registry.getSkillListDescription();

            expect(desc).toContain('## Available Skills');
            expect(desc).toContain('invoke_skill');
            expect(desc).toContain('**create-module**');
            expect(desc).toContain('Create a TypeScript module');
            expect(desc).toContain('(arguments: [path] [type])');
            expect(desc).toContain('**run-tests**');
            // run-tests has no argumentHint so its line ends after description
            const runTestsLine = desc.split('\n').find((l: string) => l.includes('run-tests'));
            expect(runTestsLine).toBe('- **run-tests**: Run all tests');

        });
    });
});
