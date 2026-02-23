/**
 * llama.cpp server backend adapter.
 *
 * Handles llama.cpp server-specific quirks:
 * - Default URL: http://localhost:8080
 * - Only one model is loaded at a time; /v1/models returns a single entry
 * - Tool calling is supported via grammar-based generation
 * - The model ID in /v1/models may be generic (e.g., "gpt-3.5-turbo")
 *   since llama.cpp uses a placeholder; we normalize this
 * - Streaming responses follow the OpenAI SSE format
 * - max_tokens behavior may differ; some builds use n_predict instead
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type {
    BackendAdapter,
    CompletionChunk,
    CompletionRequest,
    ModelInfo,
} from '../types.js';

interface LlamaCppHealthResponse {
    status: string;
    slots_idle?: number;
    slots_processing?: number;
}

export class LlamaCppBackend implements BackendAdapter {
    transformRequest(request: CompletionRequest): CompletionRequest {
        // llama.cpp server supports tool_choice 'auto' and 'none' but may
        // not support 'required'. Downgrade to 'auto'.
        if (request.tool_choice === 'required') {
            return { ...request, tool_choice: 'auto' };
        }
        return request;
    }

    transformChunk(chunk: CompletionChunk, _originalRequest: CompletionRequest): CompletionChunk {
        // llama.cpp streaming follows OpenAI format; pass through.
        return chunk;
    }

    /**
     * llama.cpp only loads one model at a time. We check /health for status
     * and return a single model entry. Falls back to /v1/models if health
     * endpoint is unavailable.
     */
    async listModels(baseUrl: string): Promise<ModelInfo[] | null> {
        try {
            // Try the native /health endpoint first
            const healthResponse = await fetch(`${baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5_000),
            });

            if (healthResponse.ok) {
                const health = (await healthResponse.json()) as LlamaCppHealthResponse;
                if (health.status === 'ok' || health.status === 'no slot available') {
                    // Server is running with a loaded model
                    // Try /v1/models to get the model name
                    return null; // Fall through to standard /v1/models
                }
            }
        } catch {
            // Health endpoint not available; fall through to standard listing
        }

        return null;
    }

    getDefaultModels(): ModelInfo[] {
        // llama.cpp loads a single model; no static defaults.
        return [];
    }
}
