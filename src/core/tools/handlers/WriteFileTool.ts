/**
 * write_file tool: Create or overwrite a file.
 */

import * as path from 'path';
import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { WorkspaceService } from '../../../services/workspace/WorkspaceService.js';
import type { IgnoreService } from '../../../services/ignore/IgnoreService.js';
import type { PathValidator } from '../../../security/PathValidator.js';

export class WriteFileTool implements Tool {
    readonly name = 'write_file';
    readonly description = 'Create a new file or overwrite an existing file with the given content.';
    readonly requiresApproval = true;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
    };

    constructor(
        private workspaceService: WorkspaceService,
        private ignoreService: IgnoreService,
        private pathValidator: PathValidator,
    ) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const filePath = this.resolvePath(params.path as string, context.workspaceRoot);
        const content = params.content as string;

        // Security checks
        const validation = this.pathValidator.validate(filePath);
        if (!validation.safe) {
            return { success: false, output: `Path rejected: ${validation.reason}` };
        }

        if (this.ignoreService.isIgnored(filePath)) {
            return { success: false, output: `Access denied: ${filePath} is in the ignore list.` };
        }

        // Request approval
        const approved = await context.approvalService.requestApproval({
            id: `write_${Date.now()}`,
            type: 'file_write',
            description: `Write file: ${filePath}`,
            details: { path: filePath },
        });

        if (!approved) {
            return { success: false, output: 'User rejected the write operation.' };
        }

        try {
            await this.workspaceService.writeFile(filePath, content);
            return {
                success: true,
                output: `File written: ${filePath} (${content.length} characters)`,
                metadata: { path: filePath, size: content.length },
            };
        } catch (error) {
            return {
                success: false,
                output: `Error writing file: ${(error as Error).message}`,
            };
        }
    }

    private resolvePath(filePath: string, workspaceRoot: string): string {
        if (path.isAbsolute(filePath)) return path.normalize(filePath);
        return path.resolve(workspaceRoot, filePath);
    }
}
