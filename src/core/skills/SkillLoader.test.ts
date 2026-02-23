import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadAll, loadOne, parseFrontmatter } from './SkillLoader.js';
import { SkillLoadError } from '../../utils/errors.js';

// Mock fs and path
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

describe('SkillLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('parseFrontmatter', () => {
        it('should parse YAML frontmatter and body', () => {
            const content = `---
name: test-skill
description: A test skill
argument-hint: "[arg1] [arg2]"
allowed-tools: Read, Write, Glob
---

## Steps

1. Do something
2. Do something else`;

            const result = parseFrontmatter(content);

            expect(result.frontmatter['name']).toBe('test-skill');
            expect(result.frontmatter['description']).toBe('A test skill');
            expect(result.frontmatter['argument-hint']).toBe('[arg1] [arg2]');
            expect(result.frontmatter['allowed-tools']).toBe('Read, Write, Glob');
            expect(result.body).toContain('## Steps');
            expect(result.body).toContain('Do something');
        });

        it('should handle content without frontmatter', () => {
            const content = 'Just a plain body\nwith multiple lines';

            const result = parseFrontmatter(content);

            expect(result.frontmatter).toEqual({});
            expect(result.body).toBe(content);
        });

        it('should strip surrounding quotes from values', () => {
            const content = `---
name: "quoted-name"
description: 'single-quoted'
---

Body`;

            const result = parseFrontmatter(content);

            expect(result.frontmatter['name']).toBe('quoted-name');
            expect(result.frontmatter['description']).toBe('single-quoted');
        });

        it('should handle empty frontmatter', () => {
            const content = `---
---

Body content here`;

            const result = parseFrontmatter(content);

            expect(result.frontmatter).toEqual({});
            expect(result.body).toBe('Body content here');
        });
    });

    describe('loadOne', () => {
        it('should load a valid SKILL.md', () => {
            const skillDir = '/workspace/.claude/skills/my-skill';
            const skillPath = path.join(skillDir, 'SKILL.md');
            const content = `---
name: my-skill
description: My awesome skill
argument-hint: "[name]"
allowed-tools: Read, Write
---

Do something with $0`;

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(content);

            const result = loadOne(skillDir);

            expect(result).not.toBeNull();
            expect(result!.name).toBe('my-skill');
            expect(result!.description).toBe('My awesome skill');
            expect(result!.argumentHint).toBe('[name]');
            expect(result!.allowedTools).toEqual(['Read', 'Write']);
            expect(result!.body).toContain('Do something with $0');
            expect(result!.sourcePath).toBe(skillPath);
        });

        it('should return null if SKILL.md does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            const result = loadOne('/workspace/.claude/skills/nonexistent');

            expect(result).toBeNull();
        });

        it('should throw SkillLoadError if name is missing', () => {
            const skillDir = '/workspace/.claude/skills/bad-skill';
            const content = `---
description: No name field
---

Body`;

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(content);

            expect(() => loadOne(skillDir)).toThrow(SkillLoadError);
        });

        it('should handle empty allowed-tools', () => {
            const content = `---
name: minimal-skill
description: Minimal
---

Body`;

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(content);

            const result = loadOne('/workspace/.claude/skills/minimal');

            expect(result).not.toBeNull();
            expect(result!.allowedTools).toEqual([]);
        });
    });

    describe('loadAll', () => {
        it('should scan both skill directories', () => {
            // First dir exists, second doesn't
            mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
                const s = String(p);
                if (s.endsWith('.localllm/skills')) return true;
                if (s.endsWith('.claude/skills')) return false;
                if (s.endsWith('SKILL.md')) return true;
                return false;
            });

            mockFs.readdirSync.mockReturnValue([
                { name: 'skill-a', isDirectory: () => true, isFile: () => false } as unknown as fs.Dirent,
            ] as unknown as fs.Dirent[]);

            mockFs.readFileSync.mockReturnValue(`---
name: skill-a
description: Skill A
---

Body A`);

            const skills = loadAll('/workspace');

            expect(skills).toHaveLength(1);
            expect(skills[0].name).toBe('skill-a');
        });

        it('should skip duplicate skill names', () => {
            mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
                const s = String(p);
                if (s.endsWith('/skills')) return true;
                if (s.endsWith('SKILL.md')) return true;
                return false;
            });

            mockFs.readdirSync.mockReturnValue([
                { name: 'skill-a', isDirectory: () => true, isFile: () => false } as unknown as fs.Dirent,
                { name: 'skill-a-dup', isDirectory: () => true, isFile: () => false } as unknown as fs.Dirent,
            ] as unknown as fs.Dirent[]);

            // Both return the same skill name
            mockFs.readFileSync.mockReturnValue(`---
name: skill-a
description: Skill A
---

Body`);

            const skills = loadAll('/workspace');

            // Only first occurrence should be kept
            expect(skills).toHaveLength(1);
        });

        it('should return empty array when no skill directories exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            const skills = loadAll('/workspace');

            expect(skills).toEqual([]);
        });
    });
});
