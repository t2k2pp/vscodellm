/**
 * MCP (Model Context Protocol) type definitions.
 * Based on the JSON-RPC 2.0 protocol used by MCP.
 */

// ============================================
// JSON-RPC 2.0 base types
// ============================================

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: unknown;
    error?: JsonRpcError;
}

export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ============================================
// MCP protocol types
// ============================================

/** MCP server capabilities returned during initialization. */
export interface McpCapabilities {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
}

/** MCP server info returned during initialization. */
export interface McpServerInfo {
    name: string;
    version: string;
}

/** MCP initialization result. */
export interface McpInitializeResult {
    protocolVersion: string;
    capabilities: McpCapabilities;
    serverInfo: McpServerInfo;
}

/** MCP tool definition as reported by the server. */
export interface McpToolDefinition {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
}

/** MCP tools/list result. */
export interface McpToolsListResult {
    tools: McpToolDefinition[];
}

/** MCP tool call content item. */
export interface McpToolContent {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
}

/** MCP tools/call result. */
export interface McpToolCallResult {
    content: McpToolContent[];
    isError?: boolean;
}

// ============================================
// Transport types
// ============================================

/** Handler for incoming JSON-RPC messages. */
export type MessageHandler = (message: JsonRpcMessage) => void;

/** Transport interface for MCP communication. */
export interface McpTransport {
    /** Send a JSON-RPC message to the server. */
    send(message: JsonRpcMessage): Promise<void>;
    /** Register a handler for incoming messages. */
    onMessage(handler: MessageHandler): void;
    /** Close the transport. */
    close(): Promise<void>;
    /** Whether the transport is connected. */
    readonly isConnected: boolean;
}
