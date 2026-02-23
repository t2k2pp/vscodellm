/**
 * RulesLoader - Discovers and loads project instruction/rules files.
 *
 * Scans for project-specific rules files in the workspace root,
 * similar to how Claude Code loads CLAUDE.md, Cline loads .clinerules,
 * and Cursor loads .cursorrules.
 *
 * Supported files (checked in priority order):
 *   1. .localllm/rules.md       (project-specific, recommended)
 *   2. CLAUDE.md                 (Claude Code compatible)
 *   3. .clinerules               (Cline compatible)
 *   4. .cursorrules              (Cursor compatible)
 *   5. .github/copilot-instructions.md  (GitHub Copilot compatible)
 *
 * If multiple files exist, they are concatenated in priority order.
 * Each section is clearly labeled with its source file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('RulesLoader');

/** Supported rules files in priority order. */
const RULES_FILES = [
    '.localllm/rules.md',
    'CLAUDE.md',
    '.clinerules',
    '.cursorrules',
    '.github/copilot-instructions.md',
];

/** Maximum file size to load (64 KB). */
const MAX_FILE_SIZE = 64 * 1024;

/** Result of loading a single rules file. */
export interface RulesFileEntry {
    /** Relative path from workspace root. */
    relativePath: string;
    /** File content (may be truncated). */
    content: string;
    /** Whether the content was truncated due to size. */
    truncated: boolean;
}

/**
 * Load all project rules files from the workspace.
 * Returns an array of found rules files with their content.
 */
export function loadRulesFiles(workspaceRoot: string): RulesFileEntry[] {
    if (!workspaceRoot) return [];

    const entries: RulesFileEntry[] = [];

    for (const relativePath of RULES_FILES) {
        const fullPath = path.join(workspaceRoot, relativePath);

        if (!fs.existsSync(fullPath)) continue;

        try {
            const stat = fs.statSync(fullPath);
            if (!stat.isFile()) continue;

            let content = fs.readFileSync(fullPath, 'utf8');
            let truncated = false;

            if (content.length > MAX_FILE_SIZE) {
                content = content.slice(0, MAX_FILE_SIZE);
                truncated = true;
                logger.warn(`Rules file ${relativePath} truncated (>${MAX_FILE_SIZE} bytes)`);
            }

            content = content.trim();
            if (!content) continue;

            entries.push({ relativePath, content, truncated });
            logger.info(`Loaded rules file: ${relativePath} (${content.length} chars)`);
        } catch (error) {
            logger.warn(`Failed to read rules file ${relativePath}: ${error}`);
        }
    }

    logger.info(`Loaded ${entries.length} rules file(s)`);
    return entries;
}

/**
 * Build a single rules text block from all loaded rules entries.
 * This block is intended to be appended to the system prompt.
 */
export function buildRulesSection(entries: RulesFileEntry[]): string {
    if (entries.length === 0) return '';

    const sections: string[] = [
        '## Project Rules & Instructions',
        '',
        'The following project-specific rules and instructions MUST be followed:',
    ];

    for (const entry of entries) {
        sections.push('');
        sections.push(`### From \`${entry.relativePath}\``);
        if (entry.truncated) {
            sections.push('*(truncated due to size)*');
        }
        sections.push('');
        sections.push(entry.content);
    }

    return sections.join('\n');
}

/**
 * Convenience: load rules and build the section in one call.
 */
export function loadAndBuildRulesSection(workspaceRoot: string): string {
    const entries = loadRulesFiles(workspaceRoot);
    return buildRulesSection(entries);
}
