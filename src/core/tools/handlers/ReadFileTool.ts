/**
 * read_file tool: Read the contents of a file with line numbers.
 */

import * as path from 'path';
import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { WorkspaceService } from '../../../services/workspace/WorkspaceService.js';
import type { IgnoreService } from '../../../services/ignore/IgnoreService.js';

export class ReadFileTool implements Tool {
    readonly name = 'read_file';
    readonly description =
        'Read the contents of a file at the given path. Returns the file content with line numbers.';
    readonly requiresApproval = false;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Absolute or workspace-relative file path' },
            startLine: { type: 'number', description: 'Start line number (1-based, optional)' },
            endLine: { type: 'number', description: 'End line number (inclusive, optional)' },
        },
        required: ['path'],
    };

    constructor(
        private workspaceService: WorkspaceService,
        private ignoreService: IgnoreService,
    ) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const filePath = this.resolvePath(params.path as string, context.workspaceRoot);

        if (this.ignoreService.isIgnored(filePath)) {
            return { success: false, output: `Access denied: ${filePath} is in the ignore list.` };
        }

        try {
            const content = await this.workspaceService.readFile(filePath);
            const lines = content.split('\n');
            const start = (params.startLine as number) || 1;
            const end = (params.endLine as number) || lines.length;
            const slice = lines.slice(start - 1, end);

            const numbered = slice.map((line, i) => `${start + i}: ${line}`).join('\n');

            return {
                success: true,
                output: numbered,
                metadata: { path: filePath, lineCount: slice.length },
            };
        } catch (error) {
            return {
                success: false,
                output: `Error reading file: ${(error as Error).message}`,
            };
        }
    }

    private resolvePath(filePath: string, workspaceRoot: string): string {
        if (path.isAbsolute(filePath)) return path.normalize(filePath);
        return path.resolve(workspaceRoot, filePath);
    }
}
