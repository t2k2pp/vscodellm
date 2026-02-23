import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { McpServerManager } from './McpServerManager.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

// Mock all external dependencies
vi.mock('fs');
vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// Mock McpTransport (we don't want to spawn real processes)
vi.mock('./McpTransport.js', () => ({
    StdioTransport: vi.fn().mockImplementation(() => ({
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        onMessage: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        isConnected: true,
    })),
}));

// Mock McpClient
vi.mock('./McpClient.js', () => ({
    McpClient: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue({
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'test', version: '1.0' },
        }),
        listTools: vi.fn().mockResolvedValue([
            {
                name: 'search',
                description: 'Search tool',
                inputSchema: { type: 'object', properties: {} },
            },
        ]),
        callTool: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        isInitialized: true,
    })),
}));

const mockFs = vi.mocked(fs);

describe('McpServerManager', () => {
    let manager: McpServerManager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new McpServerManager();
    });

    describe('loadConfig', () => {
        it('should return empty array when config file does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            const configs = manager.loadConfig('/workspace');
            expect(configs).toEqual([]);
        });

        it('should parse valid config file', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                servers: [
                    {
                        name: 'my-server',
                        transport: 'stdio',
                        command: 'npx',
                        args: ['-y', 'mcp-server'],
                    },
                ],
            }));

            const configs = manager.loadConfig('/workspace');

            expect(configs).toHaveLength(1);
            expect(configs[0].name).toBe('my-server');
            expect(configs[0].command).toBe('npx');
            expect(configs[0].transport).toBe('stdio');
        });

        it('should skip entries without name or command', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                servers: [
                    { name: '', command: 'test' },
                    { name: 'valid', command: 'cmd' },
                    { name: 'no-cmd' },
                ],
            }));

            const configs = manager.loadConfig('/workspace');
            expect(configs).toHaveLength(1);
            expect(configs[0].name).toBe('valid');
        });

        it('should handle malformed JSON', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue('not json');

            const configs = manager.loadConfig('/workspace');
            expect(configs).toEqual([]);
        });
    });

    describe('startServer', () => {
        it('should start a server and register tools', async () => {
            const registry = new ToolRegistry();
            manager.setToolRegistry(registry);

            const tools = await manager.startServer({
                name: 'test-server',
                transport: 'stdio',
                command: 'echo',
                args: ['hello'],
            });

            expect(tools).toHaveLength(1);
            expect(tools[0].name).toBe('test-server__search');
            expect(registry.get('test-server__search')).toBeDefined();
            expect(manager.serverCount).toBe(1);
        });

        it('should skip non-stdio transport', async () => {
            const tools = await manager.startServer({
                name: 'sse-server',
                transport: 'sse',
                url: 'http://localhost:3000',
            });

            expect(tools).toHaveLength(0);
        });

        it('should not start duplicate servers', async () => {
            await manager.startServer({
                name: 'dup-server',
                transport: 'stdio',
                command: 'echo',
            });

            const tools = await manager.startServer({
                name: 'dup-server',
                transport: 'stdio',
                command: 'echo',
            });

            expect(tools).toHaveLength(1); // Returns existing tools
            expect(manager.serverCount).toBe(1);
        });
    });

    describe('stopServer', () => {
        it('should stop a server and unregister tools', async () => {
            const registry = new ToolRegistry();
            manager.setToolRegistry(registry);

            await manager.startServer({
                name: 'to-stop',
                transport: 'stdio',
                command: 'echo',
            });

            expect(registry.get('to-stop__search')).toBeDefined();

            await manager.stopServer('to-stop');

            expect(registry.get('to-stop__search')).toBeUndefined();
            expect(manager.serverCount).toBe(0);
        });

        it('should handle stopping non-existent server gracefully', async () => {
            await manager.stopServer('nonexistent');
            // Should not throw
        });
    });

    describe('stopAll', () => {
        it('should stop all running servers', async () => {
            const registry = new ToolRegistry();
            manager.setToolRegistry(registry);

            await manager.startServer({
                name: 'server-1',
                transport: 'stdio',
                command: 'echo',
            });
            await manager.startServer({
                name: 'server-2',
                transport: 'stdio',
                command: 'echo',
            });

            expect(manager.serverCount).toBe(2);

            await manager.stopAll();

            expect(manager.serverCount).toBe(0);
        });
    });

    describe('getRegisteredTools', () => {
        it('should return all tools from all servers', async () => {
            await manager.startServer({
                name: 'srv-a',
                transport: 'stdio',
                command: 'echo',
            });
            await manager.startServer({
                name: 'srv-b',
                transport: 'stdio',
                command: 'echo',
            });

            const tools = manager.getRegisteredTools();
            expect(tools).toHaveLength(2);
        });
    });
});
