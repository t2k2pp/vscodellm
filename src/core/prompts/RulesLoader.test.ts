import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { loadRulesFiles, buildRulesSection, loadAndBuildRulesSection } from './RulesLoader.js';

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

describe('RulesLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadRulesFiles', () => {
        it('should return empty array for empty workspace', () => {
            expect(loadRulesFiles('')).toEqual([]);
        });

        it('should load CLAUDE.md when present', () => {
            mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
                return String(p).endsWith('CLAUDE.md');
            });
            mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
            mockFs.readFileSync.mockReturnValue('# Project Rules\n\nDo this and that.');

            const entries = loadRulesFiles('/workspace');

            expect(entries).toHaveLength(1);
            expect(entries[0].relativePath).toBe('CLAUDE.md');
            expect(entries[0].content).toContain('# Project Rules');
            expect(entries[0].truncated).toBe(false);
        });

        it('should load multiple rules files in priority order', () => {
            mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
                const s = String(p);
                return s.endsWith('CLAUDE.md') || s.endsWith('.clinerules');
            });
            mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
            mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
                const s = String(p);
                if (s.endsWith('CLAUDE.md')) return 'Claude rules';
                if (s.endsWith('.clinerules')) return 'Cline rules';
                return '';
            });

            const entries = loadRulesFiles('/workspace');

            expect(entries).toHaveLength(2);
            expect(entries[0].relativePath).toBe('CLAUDE.md');
            expect(entries[1].relativePath).toBe('.clinerules');
        });

        it('should prefer .localllm/rules.md over CLAUDE.md', () => {
            mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
                const s = String(p);
                return s.endsWith('.localllm/rules.md') || s.endsWith('CLAUDE.md');
            });
            mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
            mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
                const s = String(p);
                if (s.endsWith('rules.md')) return 'Local LLM rules';
                if (s.endsWith('CLAUDE.md')) return 'Claude rules';
                return '';
            });

            const entries = loadRulesFiles('/workspace');

            expect(entries).toHaveLength(2);
            expect(entries[0].relativePath).toBe('.localllm/rules.md');
            expect(entries[1].relativePath).toBe('CLAUDE.md');
        });

        it('should skip empty files', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
            mockFs.readFileSync.mockReturnValue('   \n  \n  ');

            const entries = loadRulesFiles('/workspace');

            expect(entries).toEqual([]);
        });

        it('should truncate large files', () => {
            mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
                return String(p).endsWith('CLAUDE.md');
            });
            mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
            // 100KB content
            mockFs.readFileSync.mockReturnValue('x'.repeat(100 * 1024));

            const entries = loadRulesFiles('/workspace');

            expect(entries).toHaveLength(1);
            expect(entries[0].truncated).toBe(true);
            expect(entries[0].content.length).toBe(64 * 1024);
        });

        it('should handle read errors gracefully', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const entries = loadRulesFiles('/workspace');

            expect(entries).toEqual([]);
        });

        it('should skip directories', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({ isFile: () => false } as fs.Stats);

            const entries = loadRulesFiles('/workspace');

            expect(entries).toEqual([]);
        });
    });

    describe('buildRulesSection', () => {
        it('should return empty string for no entries', () => {
            expect(buildRulesSection([])).toBe('');
        });

        it('should build section with single entry', () => {
            const section = buildRulesSection([
                {
                    relativePath: 'CLAUDE.md',
                    content: 'Follow these rules',
                    truncated: false,
                },
            ]);

            expect(section).toContain('## Project Rules & Instructions');
            expect(section).toContain('### From `CLAUDE.md`');
            expect(section).toContain('Follow these rules');
            expect(section).not.toContain('truncated');
        });

        it('should include truncation note when applicable', () => {
            const section = buildRulesSection([
                {
                    relativePath: 'CLAUDE.md',
                    content: 'Truncated content',
                    truncated: true,
                },
            ]);

            expect(section).toContain('truncated due to size');
        });

        it('should combine multiple entries', () => {
            const section = buildRulesSection([
                { relativePath: '.localllm/rules.md', content: 'Rule A', truncated: false },
                { relativePath: 'CLAUDE.md', content: 'Rule B', truncated: false },
            ]);

            expect(section).toContain('### From `.localllm/rules.md`');
            expect(section).toContain('Rule A');
            expect(section).toContain('### From `CLAUDE.md`');
            expect(section).toContain('Rule B');
        });
    });

    describe('loadAndBuildRulesSection', () => {
        it('should load and build in one call', () => {
            mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
                return String(p).endsWith('CLAUDE.md');
            });
            mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
            mockFs.readFileSync.mockReturnValue('My rules');

            const section = loadAndBuildRulesSection('/workspace');

            expect(section).toContain('## Project Rules');
            expect(section).toContain('My rules');
        });

        it('should return empty string when no rules files exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            expect(loadAndBuildRulesSection('/workspace')).toBe('');
        });
    });
});
