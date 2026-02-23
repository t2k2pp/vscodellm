/**
 * edit_file tool: Apply search/replace edits to a file.
 */

import * as path from 'path';
import { createPatch } from 'diff';
import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { WorkspaceService } from '../../../services/workspace/WorkspaceService.js';
import type { IgnoreService } from '../../../services/ignore/IgnoreService.js';
import type { PathValidator } from '../../../security/PathValidator.js';

export class EditFileTool implements Tool {
    readonly name = 'edit_file';
    readonly description =
        'Apply search/replace edits to a file. Each edit specifies a SEARCH block (exact text to find) and a REPLACE block (text to replace it with).';
    readonly requiresApproval = true;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'File path to edit' },
            edits: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        search: { type: 'string', description: 'Exact text to search for' },
                        replace: { type: 'string', description: 'Text to replace with' },
                    },
                    required: ['search', 'replace'],
                },
                description: 'Array of search/replace blocks',
            },
        },
        required: ['path', 'edits'],
    };

    constructor(
        private workspaceService: WorkspaceService,
        private ignoreService: IgnoreService,
        private pathValidator: PathValidator,
    ) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const filePath = this.resolvePath(params.path as string, context.workspaceRoot);
        const edits = params.edits as Array<{ search: string; replace: string }>;

        // Security checks
        const validation = this.pathValidator.validate(filePath);
        if (!validation.safe) {
            return { success: false, output: `Path rejected: ${validation.reason}` };
        }

        if (this.ignoreService.isIgnored(filePath)) {
            return { success: false, output: `Access denied: ${filePath} is in the ignore list.` };
        }

        // Read original content
        let original: string;
        try {
            original = await this.workspaceService.readFile(filePath);
        } catch (error) {
            return { success: false, output: `Error reading file: ${(error as Error).message}` };
        }

        // Apply edits
        let modified = original;
        const results: string[] = [];

        for (const edit of edits) {
            const index = modified.indexOf(edit.search);
            if (index === -1) {
                results.push(
                    `WARNING: Could not find search text: "${edit.search.substring(0, 80)}${edit.search.length > 80 ? '...' : ''}"`,
                );
                continue;
            }
            modified = modified.substring(0, index) + edit.replace + modified.substring(index + edit.search.length);
            results.push(`Applied edit at offset ${index}`);
        }

        if (modified === original) {
            return { success: false, output: 'No changes were applied. Search text not found.' };
        }

        // Generate diff for approval
        const diff = createPatch(filePath, original, modified, '', '', { context: 3 });

        // Request approval
        const approved = await context.approvalService.requestApproval({
            id: `edit_${Date.now()}`,
            type: 'file_edit',
            description: `Edit file: ${filePath}`,
            details: { path: filePath, diff },
        });

        if (!approved) {
            return { success: false, output: 'User rejected the edit.' };
        }

        // Apply
        try {
            await this.workspaceService.writeFile(filePath, modified);
            return {
                success: true,
                output: `File edited: ${filePath}\n${results.join('\n')}`,
                metadata: { path: filePath, editCount: edits.length },
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
