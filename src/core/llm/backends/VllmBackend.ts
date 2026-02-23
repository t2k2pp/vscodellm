/**
 * vLLM backend adapter.
 *
 * Handles vLLM-specific quirks:
 * - Default URL: http://localhost:8000
 * - Uses standard OpenAI-compatible API (/v1/models, /v1/chat/completions)
 * - Tool calling: supports named function calling but may not support 'required'
 * - Streaming: follows OpenAI SSE format
 * - Model IDs are the HuggingFace model path (e.g., "meta-llama/Llama-3.1-8B-Instruct")
 * - Can serve multiple models with --served-model-name flag
 * - Usage statistics are included in the last streaming chunk
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type {
    BackendAdapter,
    CompletionChunk,
    CompletionRequest,
    ModelInfo,
} from '../types.js';

export class VllmBackend implements BackendAdapter {
    transformRequest(request: CompletionRequest): CompletionRequest {
        // vLLM may not support tool_choice 'required' on all models.
        // Downgrade to 'auto' for compatibility.
        if (request.tool_choice === 'required') {
            return { ...request, tool_choice: 'auto' };
        }
        return request;
    }

    transformChunk(chunk: CompletionChunk, _originalRequest: CompletionRequest): CompletionChunk {
        // vLLM follows the OpenAI SSE format closely; pass through.
        return chunk;
    }

    /**
     * vLLM uses the standard /v1/models endpoint.
     * Return null to use the default OpenAI-compatible model listing.
     */
    async listModels(_baseUrl: string): Promise<ModelInfo[] | null> {
        return null;
    }

    getDefaultModels(): ModelInfo[] {
        // vLLM models are user-configured; no static defaults.
        return [];
    }
}
