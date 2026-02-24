/**
 * LLM Provider type definitions.
 *
 * These types define the contract between the LLM provider abstraction layer
 * and the rest of the system. They follow the OpenAI API format as the
 * canonical representation, with backend adapters handling deviations.
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type { BackendType } from '../../types/messages.js';

// ============================================
// Chat Messages
// ============================================

/**
 * A single message in a chat conversation, following the OpenAI format.
 * - system: Instruction/context for the model
 * - user: Human input
 * - assistant: Model output (may include tool_calls)
 * - tool: Result of a tool call
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    /** Tool calls requested by the assistant. Only present on assistant messages. */
    tool_calls?: ToolCall[];
    /** The ID of the tool call this message is responding to. Only present on tool messages. */
    tool_call_id?: string;
}

/**
 * A tool/function call request from the model.
 */
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        /** JSON-encoded arguments string */
        arguments: string;
    };
}

// ============================================
// Completion Request / Response
// ============================================

/**
 * Request to the LLM completion endpoint.
 * Matches the OpenAI /v1/chat/completions request format.
 */
export interface CompletionRequest {
    model: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
    temperature?: number;
    max_tokens?: number;
    stream: boolean;
    stop?: string[];
}

/**
 * A single chunk from a streaming completion response (SSE).
 * Each chunk contains a delta (partial content or partial tool_calls).
 */
export interface CompletionChunk {
    id: string;
    choices: Array<{
        delta: {
            role?: string;
            content?: string | null;
            tool_calls?: Partial<ToolCall>[];
        };
        finish_reason: string | null;
    }>;
    usage?: TokenUsage;
}

/**
 * A non-streaming completion response.
 */
export interface CompletionResponse {
    id: string;
    choices: Array<{
        message: ChatMessage;
        finish_reason: string;
    }>;
    usage: TokenUsage;
}

/**
 * Token usage statistics returned by the API.
 */
export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

// ============================================
// Model Information
// ============================================

/**
 * Metadata about a specific model, including its capabilities.
 */
export interface ModelInfo {
    /** Model identifier (e.g., "llama3.2:latest", "codellama:7b") */
    id: string;
    /** Human-readable name */
    name: string;
    /** Maximum context window size in tokens */
    contextWindow: number;
    /** Whether the model supports native function/tool calling */
    supportsToolCalling: boolean;
    /** Whether the model supports streaming responses */
    supportsStreaming: boolean;
}

// ============================================
// Tool Definitions
// ============================================

/**
 * Tool definition passed to the LLM in the tools array.
 * Follows the OpenAI function calling format.
 */
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        /** JSON Schema describing the parameters */
        parameters: Record<string, unknown>;
    };
}

// ============================================
// Provider Configuration
// ============================================

/**
 * Configuration for instantiating an LLM provider.
 */
export interface ProviderConfig {
    /** Unique ID for this provider instance */
    id: string;
    /** Human-readable name (e.g., "My Ollama Server") */
    name: string;
    /** Backend type determines which adapter to use */
    backendType: BackendType;
    /** Base URL of the LLM server (e.g., "http://localhost:11434") */
    baseUrl: string;
    /** API key (empty or "not-needed" for local servers) */
    apiKey: string;
    /** Request timeout in milliseconds (default: 10 min) */
    requestTimeoutMs?: number;
}

// ============================================
// Backend Adapter Interface
// ============================================

/**
 * Adapter interface for backend-specific transformations.
 *
 * Each LLM backend (Ollama, LM Studio, etc.) may have quirks in how they
 * handle the OpenAI-compatible API. The BackendAdapter allows the
 * OpenAiCompatibleProvider to delegate backend-specific logic without
 * subclassing.
 */
export interface BackendAdapter {
    /**
     * Transform a completion request before sending to the backend.
     * Use this to handle backend-specific quirks (e.g., Ollama's tool_choice limitation).
     */
    transformRequest(request: CompletionRequest): CompletionRequest;

    /**
     * Transform a completion chunk received from the backend.
     * Use this to normalize non-standard chunk formats.
     */
    transformChunk(chunk: CompletionChunk, originalRequest: CompletionRequest): CompletionChunk;

    /**
     * List models using the backend's native API (if available).
     * Returns null to fall back to the standard /v1/models endpoint.
     */
    listModels(baseUrl: string): Promise<ModelInfo[] | null>;

    /**
     * Return default model metadata for well-known models on this backend.
     * Used to enrich model info when the API doesn't provide full metadata.
     */
    getDefaultModels(): ModelInfo[];
}

// ============================================
// Errors
// ============================================

/**
 * Error class for LLM API errors.
 * Wraps HTTP errors and backend-specific error messages.
 */
export class LlmApiError extends Error {
    public readonly statusCode: number;
    public readonly responseBody: string;
    public readonly isRetryable: boolean;

    constructor(statusCode: number, responseBody: string, message?: string) {
        const errorMessage = message ?? `LLM API error (HTTP ${statusCode}): ${responseBody}`;
        super(errorMessage);
        this.name = 'LlmApiError';
        this.statusCode = statusCode;
        this.responseBody = responseBody;

        // 429 (rate limit), 500, 502, 503, 504 are retryable
        this.isRetryable = statusCode === 429 || (statusCode >= 500 && statusCode <= 504);
    }

    /**
     * Check if the error indicates the model was not found.
     */
    get isModelNotFound(): boolean {
        return this.statusCode === 404;
    }

    /**
     * Check if the error indicates context length exceeded.
     */
    get isContextLengthExceeded(): boolean {
        const body = this.responseBody.toLowerCase();
        return (
            body.includes('context length') ||
            body.includes('context_length_exceeded') ||
            body.includes('too many tokens') ||
            body.includes('maximum context')
        );
    }
}
