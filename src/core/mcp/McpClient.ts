/**
 * McpClient - JSON-RPC 2.0 client for MCP (Model Context Protocol).
 *
 * Handles:
 *   - Connection initialization (handshake + capabilities negotiation)
 *   - tools/list - Enumerate available tools
 *   - tools/call - Execute a tool
 *   - Request ID management and timeout handling
 */

import type {
    JsonRpcMessage,
    JsonRpcRequest,
    JsonRpcResponse,
    McpTransport,
    McpInitializeResult,
    McpToolsListResult,
    McpToolCallResult,
    McpToolDefinition,
} from './types.js';
import { McpConnectionError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('McpClient');

/** Default timeout for MCP requests (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30_000;

/** MCP protocol version we support. */
const PROTOCOL_VERSION = '2024-11-05';

/** Client info sent during initialization. */
const CLIENT_INFO = {
    name: 'local-llm-agent',
    version: '0.1.0',
};

export class McpClient {
    private nextId = 1;
    private pendingRequests = new Map<
        number | string,
        { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    private initialized = false;
    private serverInfo: McpInitializeResult | null = null;

    constructor(
        private readonly transport: McpTransport,
        private readonly serverName: string,
        private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    ) {
        // Listen for responses
        this.transport.onMessage((message: JsonRpcMessage) => {
            this.handleMessage(message);
        });
    }

    /**
     * Initialize the MCP connection.
     * Must be called before any other method.
     */
    async initialize(): Promise<McpInitializeResult> {
        logger.info(`[${this.serverName}] Initializing MCP connection...`);

        const result = await this.sendRequest<McpInitializeResult>('initialize', {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: CLIENT_INFO,
        });

        this.serverInfo = result;
        this.initialized = true;

        // Send initialized notification
        await this.transport.send({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
        });

        logger.info(
            `[${this.serverName}] Connected to ${result.serverInfo.name} v${result.serverInfo.version}`,
        );

        return result;
    }

    /**
     * List all tools provided by the MCP server.
     */
    async listTools(): Promise<McpToolDefinition[]> {
        this.ensureInitialized();

        const result = await this.sendRequest<McpToolsListResult>('tools/list', {});
        logger.info(`[${this.serverName}] Found ${result.tools.length} tool(s)`);
        return result.tools;
    }

    /**
     * Call a tool on the MCP server.
     */
    async callTool(
        toolName: string,
        args: Record<string, unknown>,
    ): Promise<McpToolCallResult> {
        this.ensureInitialized();

        logger.info(`[${this.serverName}] Calling tool: ${toolName}`);

        const result = await this.sendRequest<McpToolCallResult>('tools/call', {
            name: toolName,
            arguments: args,
        });

        return result;
    }

    /**
     * Check if the client is initialized.
     */
    get isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get server info (available after initialization).
     */
    getServerInfo(): McpInitializeResult | null {
        return this.serverInfo;
    }

    /**
     * Close the client and underlying transport.
     */
    async close(): Promise<void> {
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new McpConnectionError(this.serverName, 'Client closed'));
        }
        this.pendingRequests.clear();

        await this.transport.close();
        this.initialized = false;
        logger.info(`[${this.serverName}] Client closed`);
    }

    // ============================================
    // Private methods
    // ============================================

    /**
     * Send a JSON-RPC request and wait for the response.
     */
    private async sendRequest<T>(method: string, params: Record<string, unknown>): Promise<T> {
        const id = this.nextId++;

        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };

        return new Promise<T>((resolve, reject) => {
            // Set up timeout
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(
                    new McpConnectionError(
                        this.serverName,
                        `Request "${method}" timed out after ${this.timeoutMs}ms`,
                    ),
                );
            }, this.timeoutMs);

            // Register pending request
            this.pendingRequests.set(id, {
                resolve: (value) => {
                    clearTimeout(timer);
                    resolve(value as T);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            });

            // Send the request
            this.transport.send(request).catch((err) => {
                clearTimeout(timer);
                this.pendingRequests.delete(id);
                reject(err);
            });
        });
    }

    /**
     * Handle incoming JSON-RPC messages.
     */
    private handleMessage(message: JsonRpcMessage): void {
        // Check if it's a response (has 'id' and either 'result' or 'error')
        if ('id' in message && ('result' in message || 'error' in message)) {
            const response = message as JsonRpcResponse;
            const pending = this.pendingRequests.get(response.id);

            if (!pending) {
                logger.warn(`[${this.serverName}] Received response for unknown request ID: ${response.id}`);
                return;
            }

            this.pendingRequests.delete(response.id);

            if (response.error) {
                pending.reject(
                    new McpConnectionError(
                        this.serverName,
                        `RPC error ${response.error.code}: ${response.error.message}`,
                    ),
                );
            } else {
                pending.resolve(response.result);
            }
        } else if ('method' in message && !('id' in message)) {
            // Notification from server
            logger.info(`[${this.serverName}] Notification: ${message.method}`);
        }
    }

    /**
     * Ensure the client has been initialized.
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new McpConnectionError(
                this.serverName,
                'Client not initialized. Call initialize() first.',
            );
        }
    }
}
