/**
 * Workspace file operations service.
 * Wraps vscode.workspace.fs for cross-platform file I/O.
 * All tool handlers use this instead of importing vscode directly.
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface FileInfo {
    path: string;
    name: string;
    isDirectory: boolean;
    size: number;
}

export class WorkspaceService {
    constructor(private readonly workspaceRoot: string) {}

    /**
     * Read a file's content as UTF-8 text.
     */
    async readFile(filePath: string): Promise<string> {
        const uri = vscode.Uri.file(this.resolve(filePath));
        const data = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(data);
    }

    /**
     * Write content to a file (creates parent directories if needed).
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        const resolved = this.resolve(filePath);
        const uri = vscode.Uri.file(resolved);

        // Ensure parent directory exists
        const dir = path.dirname(resolved);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));

        const data = new TextEncoder().encode(content);
        await vscode.workspace.fs.writeFile(uri, data);
    }

    /**
     * Check if a file or directory exists.
     */
    async exists(filePath: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(this.resolve(filePath));
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete a file.
     */
    async deleteFile(filePath: string): Promise<void> {
        const uri = vscode.Uri.file(this.resolve(filePath));
        await vscode.workspace.fs.delete(uri, { recursive: false });
    }

    /**
     * List files in a directory.
     */
    async listFiles(dirPath: string, recursive = false): Promise<FileInfo[]> {
        const resolved = this.resolve(dirPath);
        const results: FileInfo[] = [];

        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(resolved));

        for (const [name, type] of entries) {
            const fullPath = path.join(resolved, name);
            const isDir = type === vscode.FileType.Directory;

            if (isDir && recursive) {
                results.push({ path: fullPath, name, isDirectory: true, size: 0 });
                const subFiles = await this.listFiles(fullPath, true);
                results.push(...subFiles);
            } else {
                let size = 0;
                if (!isDir) {
                    try {
                        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
                        size = stat.size;
                    } catch {
                        // stat failed, keep size as 0
                    }
                }
                results.push({ path: fullPath, name, isDirectory: isDir, size });
            }
        }

        return results;
    }

    /**
     * Search for files matching a glob pattern.
     */
    async findFiles(pattern: string, excludePattern?: string, maxResults = 100): Promise<string[]> {
        const include = new vscode.RelativePattern(this.workspaceRoot, pattern);
        const exclude = excludePattern
            ? new vscode.RelativePattern(this.workspaceRoot, excludePattern)
            : undefined;
        const uris = await vscode.workspace.findFiles(include, exclude, maxResults);
        return uris.map((uri) => uri.fsPath);
    }

    /**
     * Search for text patterns across files.
     * Uses a simple grep-like approach: find files, then search content.
     */
    async searchText(
        pattern: string,
        include?: string,
        maxResults = 100,
    ): Promise<Array<{ path: string; line: number; text: string }>> {
        const results: Array<{ path: string; line: number; text: string }> = [];
        const filePattern = include || '**/*';
        const files = await this.findFiles(filePattern, '**/node_modules/**', 500);
        const regex = new RegExp(pattern, 'gi');

        for (const filePath of files) {
            if (results.length >= maxResults) break;
            try {
                const content = await this.readFile(filePath);
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (regex.test(lines[i])) {
                        results.push({
                            path: filePath,
                            line: i + 1,
                            text: lines[i].trim(),
                        });
                        if (results.length >= maxResults) break;
                    }
                    regex.lastIndex = 0; // Reset regex state
                }
            } catch {
                // Skip files that can't be read
            }
        }

        return results;
    }

    /**
     * Resolve a path relative to the workspace root.
     */
    private resolve(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return path.normalize(filePath);
        }
        return path.resolve(this.workspaceRoot, filePath);
    }
}
