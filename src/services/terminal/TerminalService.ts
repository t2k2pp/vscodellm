/**
 * Terminal service for executing shell commands.
 * Creates VS Code integrated terminals and captures output.
 */

import * as vscode from 'vscode';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('TerminalService');

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface CommandOptions {
    cwd?: string;
    timeout?: number;
    signal?: AbortSignal;
}

export class TerminalService implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];

    constructor(private readonly workspaceRoot: string) {}

    /**
     * Execute a command and capture output.
     * Uses child_process.exec under the hood for output capture.
     */
    async executeCommand(command: string, options: CommandOptions = {}): Promise<CommandResult> {
        const cwd = options.cwd || this.workspaceRoot;
        const timeout = options.timeout || 120_000; // 2 minutes default

        logger.info(`Executing: ${command}`, { cwd, timeout });

        // Use Node.js child_process for output capture
        const { exec } = await import('child_process');

        return new Promise<CommandResult>((resolve, reject) => {
            const child = exec(
                command,
                {
                    cwd,
                    timeout,
                    maxBuffer: 10 * 1024 * 1024, // 10MB
                    env: { ...process.env },
                },
                (error, stdout, stderr) => {
                    if (error && 'killed' in error && error.killed) {
                        reject(new Error(`Command timed out after ${timeout}ms`));
                        return;
                    }
                    resolve({
                        stdout: stdout || '',
                        stderr: stderr || '',
                        exitCode: error ? ((error as { code?: number }).code ?? 1) : 0,
                    });
                },
            );

            // Handle abort signal
            if (options.signal) {
                const onAbort = () => {
                    child.kill('SIGTERM');
                    reject(new Error('Command was aborted'));
                };
                if (options.signal.aborted) {
                    child.kill('SIGTERM');
                    reject(new Error('Command was aborted'));
                    return;
                }
                options.signal.addEventListener('abort', onAbort, { once: true });
            }
        });
    }

    /**
     * Execute a command in a visible VS Code terminal (no output capture).
     * Useful for interactive commands the user wants to see.
     */
    executeInTerminal(command: string, name = 'LLM Agent'): vscode.Terminal {
        const terminal = vscode.window.createTerminal({
            name,
            cwd: this.workspaceRoot,
        });
        terminal.show(true);
        terminal.sendText(command);
        this.disposables.push(terminal);
        return terminal;
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
    }
}
