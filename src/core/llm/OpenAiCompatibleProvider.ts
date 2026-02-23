/**
 * OpenAI-compatible LLM provider implementation.
 *
 * This is the primary provider implementation that handles the OpenAI
 * /v1/chat/completions API format used by all local LLM servers.
 * Backend-specific quirks are delegated to BackendAdapter instances.
 *
 * Features:
 * - SSE streaming with proper chunk buffering
 * - Non-streaming completion
 * - Connection testing via /v1/models
 * - Model discovery with backend-specific enrichment
 * - AbortController support with configurable timeout
 * - Request/response transformation through backend adapters
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type { LlmProvider } from './LlmProvider.js';
import type {
    BackendAdapter,
    CompletionChunk,
    CompletionRequest,
    CompletionResponse,
    ModelInfo,
    ProviderConfig,
} from './types.js';
import { LlmApiError } from './types.js';
import { TokenCounter } from './TokenCounter.js';

/** Default request timeout: 5 minutes */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Timeout for connection tests and model listing: 10 seconds */
const METADATA_TIMEOUT_MS = 10_000;

export class OpenAiCompatibleProvider implements LlmProvider {
    public readonly id: string;
    public readonly name: string;

    protected readonly baseUrl: string;
    protected readonly apiKey: string;
    protected readonly backend: BackendAdapter;
    protected readonly tokenCounter: TokenCounter;

    private _activeAbortControllers: Set<AbortController> = new Set();
    private _disposed = false;

    constructor(config: ProviderConfig, backend: BackendAdapter) {
        this.id = config.id;
        this.name = config.name;
        this.baseUrl = normalizeBaseUrl(config.baseUrl);
        this.apiKey = config.apiKey || 'not-needed';
        this.backend = backend;
        this.tokenCounter = TokenCounter.getInstance();
    }

    // ============================================
    // Connection Testing
    // ============================================

    async testConnection(): Promise<{ ok: boolean; error?: string }> {
        this._assertNotDisposed();

        try {
            const controller = new AbortController();
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
                headers: this._buildHeaders(),
                signal: AbortSignal.any([
                    controller.signal,
                    AbortSignal.timeout(METADATA_TIMEOUT_MS),
                ]),
            });

            if (response.ok) {
                return { ok: true };
            }

            // Some servers don't support /v1/models, try a simple HEAD request
            if (response.status === 404) {
                const headResponse = await fetch(this.baseUrl, {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
                });
                if (headResponse.ok) {
                    return { ok: true };
                }
            }

            return {
                ok: false,
                error: `Server returned HTTP ${response.status}: ${response.statusText}`,
            };
        } catch (error) {
            return {
                ok: false,
                error: formatConnectionError(error),
            };
        }
    }

    // ============================================
    // Model Discovery
    // ============================================

    async listModels(): Promise<ModelInfo[]> {
        this._assertNotDisposed();

        // First try the backend-specific model listing (e.g., Ollama /api/tags)
        try {
            const backendModels = await this.backend.listModels(this.baseUrl);
            if (backendModels !== null && backendModels.length > 0) {
                return backendModels;
            }
        } catch {
            // Fall through to standard endpoint
        }

        // Fall back to standard OpenAI /v1/models endpoint
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
                headers: this._buildHeaders(),
                signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
            });

            if (!response.ok) {
                throw new LlmApiError(response.status, await response.text());
            }

            const data = (await response.json()) as { data?: Array<{ id: string; owned_by?: string }> };
            const defaultModels = this.backend.getDefaultModels();
            const defaultMap = new Map(defaultModels.map((m) => [m.id, m]));

            return (data.data ?? []).map((model) => {
                const defaultInfo = defaultMap.get(model.id);
                return {
                    id: model.id,
                    name: model.id,
                    contextWindow: defaultInfo?.contextWindow ?? 4096,
                    supportsToolCalling: defaultInfo?.supportsToolCalling ?? true,
                    supportsStreaming: defaultInfo?.supportsStreaming ?? true,
                };
            });
        } catch (error) {
            if (error instanceof LlmApiError) {
                throw error;
            }
            throw new LlmApiError(0, String(error), `Failed to list models: ${String(error)}`);
        }
    }

    // ============================================
    // Streaming Completion
    // ============================================

    async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
        this._assertNotDisposed();

        // Transform request through the backend adapter
        const transformedRequest = this.backend.transformRequest({
            ...request,
            stream: true,
        });

        const abortController = new AbortController();
        this._activeAbortControllers.add(abortController);

        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: this._buildHeaders(),
                body: JSON.stringify(transformedRequest),
                signal: AbortSignal.any([
                    abortController.signal,
                    AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
                ]),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new LlmApiError(response.status, errorBody);
            }

            if (!response.body) {
                throw new LlmApiError(0, 'Response body is null', 'Server returned empty response body');
            }

            yield* this._parseSSEStream(response.body, request);
        } finally {
            this._activeAbortControllers.delete(abortController);
        }
    }

    // ============================================
    // Non-Streaming Completion
    // ============================================

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        this._assertNotDisposed();

        // Transform request through the backend adapter
        const transformedRequest = this.backend.transformRequest({
            ...request,
            stream: false,
        });

        const abortController = new AbortController();
        this._activeAbortControllers.add(abortController);

        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: this._buildHeaders(),
                body: JSON.stringify(transformedRequest),
                signal: AbortSignal.any([
                    abortController.signal,
                    AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
                ]),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new LlmApiError(response.status, errorBody);
            }

            const data = (await response.json()) as CompletionResponse;
            return data;
        } finally {
            this._activeAbortControllers.delete(abortController);
        }
    }

    // ============================================
    // Token Counting
    // ============================================

    countTokens(text: string): number {
        return this.tokenCounter.count(text);
    }

    // ============================================
    // Model Info
    // ============================================

    async getModelInfo(modelId: string): Promise<ModelInfo | null> {
        this._assertNotDisposed();

        // Check backend defaults first (fast, no network)
        const defaults = this.backend.getDefaultModels();
        const found = defaults.find((m) => m.id === modelId);
        if (found) {
            return found;
        }

        // Try listing models and finding a match
        try {
            const models = await this.listModels();
            return models.find((m) => m.id === modelId) ?? null;
        } catch {
            return null;
        }
    }

    // ============================================
    // Disposal
    // ============================================

    dispose(): void {
        this._disposed = true;

        // Abort all active requests
        for (const controller of this._activeAbortControllers) {
            controller.abort(new Error('Provider disposed'));
        }
        this._activeAbortControllers.clear();
    }

    // ============================================
    // SSE Stream Parsing
    // ============================================

    /**
     * Parse a Server-Sent Events (SSE) stream from the response body.
     *
     * Handles:
     * - "data: " prefixed lines
     * - "[DONE]" termination signal
     * - Buffering of incomplete lines across chunks
     * - Multi-event frames in a single network chunk
     * - Malformed JSON gracefully (skip and continue)
     */
    private async *_parseSSEStream(
        body: ReadableStream<Uint8Array>,
        originalRequest: CompletionRequest
    ): AsyncIterable<CompletionChunk> {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Decode the chunk and append to the buffer.
                // { stream: true } tells the decoder not to flush a multi-byte
                // character that may be split across chunks.
                buffer += decoder.decode(value, { stream: true });

                // Split on newlines. The last element may be incomplete,
                // so we keep it in the buffer for the next iteration.
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();

                    // Skip empty lines (SSE uses blank lines as event separators)
                    if (trimmed === '') {
                        continue;
                    }

                    // SSE comment lines start with ':'
                    if (trimmed.startsWith(':')) {
                        continue;
                    }

                    // Data lines
                    if (trimmed.startsWith('data:')) {
                        // Handle both "data: {...}" and "data:{...}" (some servers omit the space)
                        const data = trimmed.slice(5).trim();

                        // [DONE] signals the end of the stream
                        if (data === '[DONE]') {
                            return;
                        }

                        // Skip empty data
                        if (data === '') {
                            continue;
                        }

                        try {
                            const chunk = JSON.parse(data) as CompletionChunk;
                            yield this.backend.transformChunk(chunk, originalRequest);
                        } catch {
                            // Skip malformed JSON chunks. This can happen with some
                            // backends that send partial or non-standard data.
                        }
                    }
                }
            }

            // Process any remaining data in the buffer after the stream ends
            if (buffer.trim() !== '') {
                const trimmed = buffer.trim();
                if (trimmed.startsWith('data:')) {
                    const data = trimmed.slice(5).trim();
                    if (data !== '[DONE]' && data !== '') {
                        try {
                            const chunk = JSON.parse(data) as CompletionChunk;
                            yield this.backend.transformChunk(chunk, originalRequest);
                        } catch {
                            // Skip malformed final chunk
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    // ============================================
    // Internal Helpers
    // ============================================

    private _buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Only include Authorization header if there's a meaningful API key
        if (this.apiKey && this.apiKey !== 'not-needed') {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    private _assertNotDisposed(): void {
        if (this._disposed) {
            throw new Error(`Provider "${this.id}" has been disposed`);
        }
    }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Normalize a base URL by removing trailing slashes.
 */
function normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
}

/**
 * Format a connection error into a human-readable message.
 */
function formatConnectionError(error: unknown): string {
    if (error instanceof TypeError && String(error).includes('fetch')) {
        return 'Could not connect to the server. Is the LLM server running?';
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
        return 'Connection timed out. The server may be unresponsive.';
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
        return 'Connection was aborted.';
    }
    if (error instanceof Error) {
        // Common Node.js connection errors
        const msg = error.message;
        if (msg.includes('ECONNREFUSED')) {
            return 'Connection refused. Is the LLM server running on the configured port?';
        }
        if (msg.includes('ENOTFOUND')) {
            return 'Server not found. Check the base URL in settings.';
        }
        if (msg.includes('ECONNRESET')) {
            return 'Connection was reset by the server.';
        }
        return msg;
    }
    return String(error);
}
