/**
 * Abstract LLM Provider interface.
 *
 * All LLM providers (Ollama, LM Studio, llama.cpp, vLLM, generic)
 * implement this interface. The primary implementation is
 * OpenAiCompatibleProvider, which handles the OpenAI-compatible API
 * and delegates backend-specific quirks to BackendAdapter instances.
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type { CompletionChunk, CompletionRequest, CompletionResponse, ModelInfo } from './types.js';

/**
 * Interface for LLM provider implementations.
 *
 * Usage:
 * ```ts
 * const provider = registry.getActive();
 * const { ok } = await provider.testConnection();
 * if (ok) {
 *   for await (const chunk of provider.streamCompletion(request)) {
 *     process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
 *   }
 * }
 * ```
 */
export interface LlmProvider {
    /** Unique identifier for this provider instance */
    readonly id: string;

    /** Human-readable name */
    readonly name: string;

    /**
     * Check if the LLM server is reachable and responding.
     * Typically sends a lightweight request (HEAD or GET /v1/models).
     *
     * @returns Object with ok=true if connected, or ok=false with an error message.
     */
    testConnection(): Promise<{ ok: boolean; error?: string }>;

    /**
     * List available models from the server.
     * May use backend-specific APIs for richer metadata.
     *
     * @returns Array of ModelInfo objects describing each available model.
     */
    listModels(): Promise<ModelInfo[]>;

    /**
     * Send a streaming completion request.
     * Returns an async iterable of CompletionChunk, each containing
     * a delta of content and/or tool calls.
     *
     * The stream ends when:
     * - The server sends [DONE]
     * - finish_reason is set (e.g., "stop", "tool_calls")
     * - The connection is closed
     *
     * @param request - The completion request (stream flag is forced to true internally)
     * @returns AsyncIterable yielding CompletionChunk objects
     * @throws LlmApiError on HTTP or API errors
     */
    streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk>;

    /**
     * Send a non-streaming completion request.
     * Waits for the full response before returning.
     *
     * @param request - The completion request (stream flag is forced to false internally)
     * @returns The complete CompletionResponse
     * @throws LlmApiError on HTTP or API errors
     */
    complete(request: CompletionRequest): Promise<CompletionResponse>;

    /**
     * Count the approximate number of tokens in the given text.
     * Uses cl100k_base tokenizer as an approximation for local models.
     *
     * @param text - The text to count tokens for
     * @returns Approximate token count
     */
    countTokens(text: string): number;

    /**
     * Get capability information for a specific model.
     * Returns null if the model is unknown.
     *
     * @param modelId - The model identifier to look up
     * @returns ModelInfo if found, null otherwise
     */
    getModelInfo(modelId: string): Promise<ModelInfo | null>;

    /**
     * Release any resources held by this provider.
     * Called during extension deactivation or when the provider is replaced.
     */
    dispose(): void;
}
