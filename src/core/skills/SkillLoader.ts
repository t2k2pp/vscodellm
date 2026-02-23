/**
 * SkillLoader - Discovers and parses SKILL.md files from workspace directories.
 *
 * Scans for skill definitions in:
 *   - .localllm/skills/<name>/SKILL.md (project-specific)
 *   - .claude/skills/<name>/SKILL.md   (Claude Code compatible)
 *
 * Each SKILL.md has YAML frontmatter (name, description, argument-hint, allowed-tools)
 * followed by a Markdown body that serves as the instruction template for the LLM.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SkillDefinition } from '../../types/skills.js';
import { SkillLoadError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('SkillLoader');

/** Directories to scan for skill definitions (relative to workspace root). */
const SKILL_DIRS = ['.localllm/skills', '.claude/skills'];

/** Filename expected inside each skill directory. */
const SKILL_FILENAME = 'SKILL.md';

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Uses simple regex-based parsing (no external YAML dependency).
 */
export function parseFrontmatter(content: string): {
    frontmatter: Record<string, string>;
    body: string;
} {
    const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)---[ \t]*\r?\n([\s\S]*)$/);
    if (!match) {
        return { frontmatter: {}, body: content.trim() };
    }

    const yamlBlock = match[1];
    const body = match[2].trim();
    const frontmatter: Record<string, string> = {};

    for (const line of yamlBlock.split('\n')) {
        const kvMatch = line.match(/^(\S[\w-]*)\s*:\s*(.*)$/);
        if (kvMatch) {
            const key = kvMatch[1].trim();
            // Strip surrounding quotes if present
            let value = kvMatch[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            frontmatter[key] = value;
        }
    }

    return { frontmatter, body };
}

/**
 * Load a single skill from a directory containing SKILL.md.
 */
export function loadOne(skillDir: string): SkillDefinition | null {
    const skillPath = path.join(skillDir, SKILL_FILENAME);

    if (!fs.existsSync(skillPath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(skillPath, 'utf8');
        const { frontmatter, body } = parseFrontmatter(content);

        // Name is required
        const name = frontmatter['name'];
        if (!name) {
            throw new SkillLoadError(
                path.basename(skillDir),
                'Missing required "name" field in frontmatter',
            );
        }

        const description = frontmatter['description'] || '';
        const argumentHint = frontmatter['argument-hint'] || undefined;
        const allowedToolsRaw = frontmatter['allowed-tools'] || '';
        const allowedTools = allowedToolsRaw
            ? allowedToolsRaw.split(',').map((t) => t.trim()).filter(Boolean)
            : [];

        return {
            name,
            description,
            argumentHint,
            allowedTools,
            body,
            sourcePath: skillPath,
        };
    } catch (error) {
        if (error instanceof SkillLoadError) {
            throw error;
        }
        logger.error(`Failed to load skill from ${skillDir}`, error);
        return null;
    }
}

/**
 * Load all skills from the workspace.
 * Scans SKILL_DIRS for subdirectories containing SKILL.md files.
 */
export function loadAll(workspaceRoot: string): SkillDefinition[] {
    const skills: SkillDefinition[] = [];
    const seenNames = new Set<string>();

    for (const dir of SKILL_DIRS) {
        const skillsBaseDir = path.join(workspaceRoot, dir);

        if (!fs.existsSync(skillsBaseDir)) {
            continue;
        }

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(skillsBaseDir, { withFileTypes: true });
        } catch {
            logger.warn(`Cannot read skill directory: ${skillsBaseDir}`);
            continue;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const skillDir = path.join(skillsBaseDir, entry.name);
            try {
                const skill = loadOne(skillDir);
                if (skill && !seenNames.has(skill.name)) {
                    skills.push(skill);
                    seenNames.add(skill.name);
                    logger.info(`Loaded skill: ${skill.name} from ${skill.sourcePath}`);
                } else if (skill && seenNames.has(skill.name)) {
                    logger.warn(`Duplicate skill name "${skill.name}" ignored from ${skillDir}`);
                }
            } catch (error) {
                logger.error(`Error loading skill from ${skillDir}`, error);
            }
        }
    }

    logger.info(`Loaded ${skills.length} skill(s) total`);
    return skills;
}
