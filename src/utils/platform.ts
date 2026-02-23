/**
 * Cross-platform path utilities.
 * All file path operations in core/ should use these helpers.
 */

import * as path from 'path';

/**
 * Normalize a file path to use forward slashes (for consistent display).
 */
export function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/**
 * Resolve a path relative to the workspace root.
 * If the path is already absolute, returns it as-is.
 */
export function resolveWorkspacePath(workspaceRoot: string, filePath: string): string {
    if (path.isAbsolute(filePath)) {
        return path.normalize(filePath);
    }
    return path.resolve(workspaceRoot, filePath);
}

/**
 * Get a path relative to the workspace root for display.
 */
export function toRelativePath(workspaceRoot: string, filePath: string): string {
    const relative = path.relative(workspaceRoot, filePath);
    return normalizePath(relative);
}

/**
 * Check if a path is within the given root directory.
 */
export function isWithinDirectory(root: string, filePath: string): boolean {
    const resolvedRoot = path.resolve(root) + path.sep;
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(resolvedRoot) || resolvedPath === path.resolve(root);
}
