/**
 * search_files tool: Search for text patterns across workspace files.
 */

import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { WorkspaceService } from '../../../services/workspace/WorkspaceService.js';

export class SearchFilesTool implements Tool {
    readonly name = 'search_files';
    readonly description =
        'Search for a text pattern (regex) across files in the workspace. Returns matching lines with file paths and line numbers.';
    readonly requiresApproval = false;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: 'Search pattern (regex supported)' },
            path: { type: 'string', description: 'Subdirectory to search in (optional)' },
            filePattern: { type: 'string', description: 'Glob pattern to filter files (e.g. "*.ts") (optional)' },
        },
        required: ['pattern'],
    };

    constructor(private workspaceService: WorkspaceService) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const pattern = params.pattern as string;
        const include = params.filePattern as string | undefined;

        try {
            const results = await this.workspaceService.searchText(pattern, include, 50);

            if (results.length === 0) {
                return { success: true, output: 'No matches found.' };
            }

            const output = results
                .map((r) => `${r.path}:${r.line}: ${r.text}`)
                .join('\n');

            return {
                success: true,
                output: `Found ${results.length} matches:\n\n${output}`,
                metadata: { matchCount: results.length },
            };
        } catch (error) {
            return {
                success: false,
                output: `Search failed: ${(error as Error).message}`,
            };
        }
    }
}
