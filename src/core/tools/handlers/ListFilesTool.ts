/**
 * list_files tool: List files in a directory.
 */

import * as path from 'path';
import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { WorkspaceService } from '../../../services/workspace/WorkspaceService.js';
import type { IgnoreService } from '../../../services/ignore/IgnoreService.js';

export class ListFilesTool implements Tool {
    readonly name = 'list_files';
    readonly description = 'List files and directories at the given path. Use recursive=true to list all nested files.';
    readonly requiresApproval = false;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Directory path to list (defaults to workspace root)' },
            recursive: { type: 'boolean', description: 'Whether to list files recursively (default: false)' },
        },
        required: [],
    };

    constructor(
        private workspaceService: WorkspaceService,
        private ignoreService: IgnoreService,
    ) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const dirPath = (params.path as string) || context.workspaceRoot;
        const recursive = (params.recursive as boolean) || false;
        const resolvedPath = path.isAbsolute(dirPath) ? dirPath : path.resolve(context.workspaceRoot, dirPath);

        try {
            const files = await this.workspaceService.listFiles(resolvedPath, recursive);

            // Filter out ignored files
            const visible = files.filter((f) => !this.ignoreService.isIgnored(f.path));

            if (visible.length === 0) {
                return { success: true, output: 'Directory is empty or all files are ignored.' };
            }

            const output = visible
                .map((f) => {
                    const rel = path.relative(context.workspaceRoot, f.path);
                    const suffix = f.isDirectory ? '/' : ` (${this.formatSize(f.size)})`;
                    return `${rel}${suffix}`;
                })
                .join('\n');

            return {
                success: true,
                output,
                metadata: { fileCount: visible.length, directory: resolvedPath },
            };
        } catch (error) {
            return {
                success: false,
                output: `Error listing files: ${(error as Error).message}`,
            };
        }
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
}
