import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpClient } from './McpClient.js';
import type { McpTransport, JsonRpcMessage, JsonRpcResponse, MessageHandler } from './types.js';
import { McpConnectionError } from '../../utils/errors.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

/** Create a mock transport that captures sent messages and lets us respond. */
function createMockTransport(): McpTransport & {
    sentMessages: JsonRpcMessage[];
    handlers: MessageHandler[];
    simulateResponse: (response: JsonRpcResponse) => void;
} {
    const handlers: MessageHandler[] = [];
    const sentMessages: JsonRpcMessage[] = [];

    return {
        sentMessages,
        handlers,
        isConnected: true,
        send: vi.fn().mockImplementation(async (msg: JsonRpcMessage) => {
            sentMessages.push(msg);
        }),
        onMessage: vi.fn().mockImplementation((handler: MessageHandler) => {
            handlers.push(handler);
        }),
        close: vi.fn().mockResolvedValue(undefined),
        simulateResponse(response: JsonRpcResponse) {
            for (const handler of handlers) {
                handler(response);
            }
        },
    };
}

describe('McpClient', () => {
    let transport: ReturnType<typeof createMockTransport>;
    let client: McpClient;

    beforeEach(() => {
        vi.clearAllMocks();
        transport = createMockTransport();
        client = new McpClient(transport, 'test-server', 5000);
    });

    describe('initialize', () => {
        it('should send initialize request and return server info', async () => {
            // Simulate response to initialize
            const initPromise = client.initialize();

            // Wait for send to be called
            await vi.waitFor(() => {
                expect(transport.sentMessages.length).toBeGreaterThan(0);
            });

            const initRequest = transport.sentMessages[0];
            expect(initRequest).toMatchObject({
                jsonrpc: '2.0',
                method: 'initialize',
            });

            // Send response
            transport.simulateResponse({
                jsonrpc: '2.0',
                id: (initRequest as any).id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {} },
                    serverInfo: { name: 'test', version: '1.0' },
                },
            });

            const result = await initPromise;

            expect(result.serverInfo.name).toBe('test');
            expect(result.protocolVersion).toBe('2024-11-05');
            expect(client.isInitialized).toBe(true);
        });
    });

    describe('listTools', () => {
        it('should throw if not initialized', async () => {
            await expect(client.listTools()).rejects.toThrow(McpConnectionError);
        });
    });

    describe('callTool', () => {
        it('should throw if not initialized', async () => {
            await expect(client.callTool('test', {})).rejects.toThrow(McpConnectionError);
        });
    });

    describe('close', () => {
        it('should close transport and reject pending requests', async () => {
            await client.close();

            expect(transport.close).toHaveBeenCalled();
            expect(client.isInitialized).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should handle RPC error responses', async () => {
            const initPromise = client.initialize();

            await vi.waitFor(() => {
                expect(transport.sentMessages.length).toBeGreaterThan(0);
            });

            transport.simulateResponse({
                jsonrpc: '2.0',
                id: (transport.sentMessages[0] as any).id,
                error: { code: -32600, message: 'Invalid request' },
            });

            await expect(initPromise).rejects.toThrow(McpConnectionError);
        });
    });
});
