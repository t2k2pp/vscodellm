/**
 * MCP Transport implementations.
 *
 * StdioTransport: Spawns a child process and communicates via stdin/stdout.
 * SseTransport:   Future implementation for HTTP+SSE based servers.
 */

import { spawn, type ChildProcess } from 'child_process';
import type { JsonRpcMessage, McpTransport, MessageHandler } from './types.js';
import { McpConnectionError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('McpTransport');

/**
 * Stdio-based MCP transport.
 * Spawns a child process and communicates via stdin (write) / stdout (read).
 */
export class StdioTransport implements McpTransport {
    private process: ChildProcess | null = null;
    private messageHandlers: MessageHandler[] = [];
    private buffer = '';
    private _isConnected = false;
    private readonly serverName: string;

    constructor(
        private readonly command: string,
        private readonly args: string[] = [],
        private readonly env?: Record<string, string>,
        serverName?: string,
    ) {
        this.serverName = serverName ?? command;
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    /**
     * Start the child process and begin listening.
     */
    async start(): Promise<void> {
        try {
            const mergedEnv = { ...process.env, ...this.env };

            this.process = spawn(this.command, this.args, {
                env: mergedEnv,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.process.stdout!.on('data', (data: Buffer) => {
                this.handleData(data.toString('utf8'));
            });

            this.process.stderr!.on('data', (data: Buffer) => {
                logger.warn(`[${this.serverName}] stderr: ${data.toString('utf8').trim()}`);
            });

            this.process.on('error', (err) => {
                logger.error(`[${this.serverName}] process error`, err);
                this._isConnected = false;
            });

            this.process.on('exit', (code) => {
                logger.info(`[${this.serverName}] process exited with code ${code}`);
                this._isConnected = false;
            });

            this._isConnected = true;
            logger.info(`[${this.serverName}] Started: ${this.command} ${this.args.join(' ')}`);
        } catch (error) {
            throw new McpConnectionError(
                this.serverName,
                `Failed to start process: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined,
            );
        }
    }

    async send(message: JsonRpcMessage): Promise<void> {
        if (!this.process?.stdin?.writable) {
            throw new McpConnectionError(this.serverName, 'Transport not connected');
        }

        const json = JSON.stringify(message);
        const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;

        return new Promise((resolve, reject) => {
            this.process!.stdin!.write(data, 'utf8', (err) => {
                if (err) {
                    reject(new McpConnectionError(this.serverName, `Write failed: ${err.message}`, err));
                } else {
                    resolve();
                }
            });
        });
    }

    onMessage(handler: MessageHandler): void {
        this.messageHandlers.push(handler);
    }

    async close(): Promise<void> {
        this._isConnected = false;
        if (this.process) {
            this.process.stdin?.end();
            this.process.kill('SIGTERM');

            // Give process time to exit gracefully
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    this.process?.kill('SIGKILL');
                    resolve();
                }, 3000);

                this.process!.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            this.process = null;
        }
        this.messageHandlers = [];
        logger.info(`[${this.serverName}] Transport closed`);
    }

    /**
     * Handle incoming data from stdout.
     * Implements JSON-RPC message framing (Content-Length header).
     */
    private handleData(data: string): void {
        this.buffer += data;

        while (this.buffer.length > 0) {
            // Look for Content-Length header
            const headerEnd = this.buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) {
                break; // Incomplete header
            }

            const header = this.buffer.slice(0, headerEnd);
            const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
            if (!contentLengthMatch) {
                // Try to parse as raw JSON (some servers send without Content-Length)
                this.tryParseRawJson();
                break;
            }

            const contentLength = parseInt(contentLengthMatch[1], 10);
            const bodyStart = headerEnd + 4; // After \r\n\r\n

            if (this.buffer.length < bodyStart + contentLength) {
                break; // Incomplete body
            }

            const body = this.buffer.slice(bodyStart, bodyStart + contentLength);
            this.buffer = this.buffer.slice(bodyStart + contentLength);

            this.parseAndDispatch(body);
        }
    }

    /**
     * Try to parse buffer as raw JSON lines (fallback for servers without Content-Length).
     */
    private tryParseRawJson(): void {
        const lines = this.buffer.split('\n');
        this.buffer = '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
                if (trimmed.startsWith('{')) {
                    this.parseAndDispatch(trimmed);
                } else {
                    // Non-JSON line, put it back
                    this.buffer += line + '\n';
                }
            }
        }
    }

    /**
     * Parse a JSON string and dispatch to handlers.
     */
    private parseAndDispatch(json: string): void {
        try {
            const message = JSON.parse(json) as JsonRpcMessage;
            for (const handler of this.messageHandlers) {
                try {
                    handler(message);
                } catch (error) {
                    logger.error(`[${this.serverName}] Message handler error`, error);
                }
            }
        } catch (error) {
            logger.warn(`[${this.serverName}] Failed to parse JSON-RPC message: ${json.slice(0, 100)}`);
        }
    }
}
