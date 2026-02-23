/**
 * execute_command tool: Run a shell command and capture output.
 */

import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { TerminalService } from '../../../services/terminal/TerminalService.js';
import type { CommandSanitizer } from '../../../security/CommandSanitizer.js';

export class ExecuteCommandTool implements Tool {
    readonly name = 'execute_command';
    readonly description = 'Run a shell command in the integrated terminal. Returns the command output (stdout and stderr).';
    readonly requiresApproval = true;

    readonly parameterSchema = {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The shell command to execute' },
            cwd: { type: 'string', description: 'Working directory (defaults to workspace root)' },
        },
        required: ['command'],
    };

    constructor(
        private terminalService: TerminalService,
        private commandSanitizer: CommandSanitizer,
    ) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const command = params.command as string;
        const cwd = (params.cwd as string) || context.workspaceRoot;

        // Security: sanitize command
        const sanitized = this.commandSanitizer.sanitize(command);
        if (!sanitized.safe) {
            return { success: false, output: `Command blocked: ${sanitized.reason}` };
        }

        // Request approval (include warning if any)
        const description = sanitized.warning
            ? `Execute command (WARNING: ${sanitized.warning}): ${command}`
            : `Execute command: ${command}`;

        const approved = await context.approvalService.requestApproval({
            id: `cmd_${Date.now()}`,
            type: 'command_execution',
            description,
            details: { command, cwd },
        });

        if (!approved) {
            return { success: false, output: 'User rejected the command.' };
        }

        try {
            const result = await this.terminalService.executeCommand(command, {
                cwd,
                timeout: 120_000,
                signal: context.abortSignal,
            });

            const output = this.truncateOutput(
                (result.stdout + (result.stderr ? '\n--- stderr ---\n' + result.stderr : '')).trim(),
                8000,
            );

            return {
                success: result.exitCode === 0,
                output: output || '(no output)',
                metadata: { exitCode: result.exitCode },
            };
        } catch (error) {
            return {
                success: false,
                output: `Command execution failed: ${(error as Error).message}`,
            };
        }
    }

    private truncateOutput(output: string, maxChars: number): string {
        if (output.length <= maxChars) return output;
        const half = Math.floor(maxChars / 2);
        return output.slice(0, half) + '\n\n... [truncated] ...\n\n' + output.slice(-half);
    }
}
