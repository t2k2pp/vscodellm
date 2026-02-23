/**
 * File ignore service.
 * Combines built-in blocked patterns, .gitignore, and .localllmignore rules
 * to determine which files the agent should not access.
 */

import * as path from 'path';
import * as fs from 'fs';
import ignore, { type Ignore } from 'ignore';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('IgnoreService');

/** Default patterns that are always ignored (security-sensitive files). */
const DEFAULT_BLOCKED_PATTERNS = [
    '.env',
    '.env.*',
    '**/.env',
    '**/secrets.*',
    '**/*credential*',
    '**/*secret*',
    '**/id_rsa',
    '**/*.pem',
    '**/*.key',
    'node_modules/',
    '.git/',
];

export class IgnoreService {
    private ig: Ignore;
    private initialized = false;

    constructor(private readonly workspaceRoot: string) {
        this.ig = ignore();
    }

    /**
     * Initialize by loading ignore patterns from files.
     * Call this once after construction.
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Always add default blocked patterns
        this.ig.add(DEFAULT_BLOCKED_PATTERNS);

        // Load .localllmignore if it exists
        await this.loadIgnoreFile(path.join(this.workspaceRoot, '.localllmignore'));

        // Also respect .gitignore
        await this.loadIgnoreFile(path.join(this.workspaceRoot, '.gitignore'));

        this.initialized = true;
        logger.info('Ignore patterns loaded');
    }

    /**
     * Check if a file path should be ignored.
     */
    isIgnored(filePath: string): boolean {
        // Ensure we work with a relative path
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath);
        const relative = path.relative(this.workspaceRoot, absolutePath);

        // Don't check paths outside workspace
        if (relative.startsWith('..')) {
            return true; // Outside workspace = blocked
        }

        return this.ig.ignores(relative);
    }

    /**
     * Filter an array of paths, removing ignored ones.
     */
    filterPaths(filePaths: string[]): string[] {
        return filePaths.filter((p) => !this.isIgnored(p));
    }

    /**
     * Add additional ignore patterns at runtime.
     */
    addPatterns(patterns: string[]): void {
        this.ig.add(patterns);
    }

    private async loadIgnoreFile(filePath: string): Promise<void> {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            this.ig.add(content);
            logger.debug(`Loaded ignore patterns from ${filePath}`);
        } catch {
            // File doesn't exist, that's fine
        }
    }
}
