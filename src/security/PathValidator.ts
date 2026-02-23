/**
 * File path access control.
 * Validates that file paths are safe to access (within workspace, no traversal).
 */

import * as path from 'path';

export interface PathValidationResult {
    safe: boolean;
    resolvedPath: string;
    reason?: string;
}

export class PathValidator {
    private readonly workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = path.resolve(workspaceRoot);
    }

    /**
     * Validate that a file path is safe to access.
     * - Must be within the workspace root (no path traversal)
     * - Must not contain null bytes or other dangerous characters
     */
    validate(filePath: string): PathValidationResult {
        // Check for null bytes
        if (filePath.includes('\0')) {
            return {
                safe: false,
                resolvedPath: filePath,
                reason: 'Path contains null bytes',
            };
        }

        // Resolve to absolute path
        const resolved = path.resolve(this.workspaceRoot, filePath);

        // Check for path traversal
        const normalizedRoot = this.workspaceRoot + path.sep;
        if (!resolved.startsWith(normalizedRoot) && resolved !== this.workspaceRoot) {
            return {
                safe: false,
                resolvedPath: resolved,
                reason: 'Path traversal detected: file is outside workspace',
            };
        }

        return { safe: true, resolvedPath: resolved };
    }

    /**
     * Validate and return the resolved path, or throw if invalid.
     */
    validateOrThrow(filePath: string): string {
        const result = this.validate(filePath);
        if (!result.safe) {
            throw new Error(result.reason);
        }
        return result.resolvedPath;
    }
}
