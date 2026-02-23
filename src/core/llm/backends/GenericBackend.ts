/**
 * Generic (passthrough) backend adapter.
 *
 * Used as the default fallback for any OpenAI-compatible server that
 * doesn't have a specialized backend adapter. Performs no transformations
 * on requests or responses.
 *
 * This is appropriate for:
 * - Standard OpenAI API endpoints
 * - Any LLM server that fully implements the OpenAI API spec
 * - Testing with mock servers
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type {
    BackendAdapter,
    CompletionChunk,
    CompletionRequest,
    ModelInfo,
} from '../types.js';

export class GenericBackend implements BackendAdapter {
    /**
     * Pass the request through unchanged.
     * Generic servers are assumed to fully support the OpenAI API spec.
     */
    transformRequest(request: CompletionRequest): CompletionRequest {
        return request;
    }

    /**
     * Pass the chunk through unchanged.
     */
    transformChunk(chunk: CompletionChunk, _originalRequest: CompletionRequest): CompletionChunk {
        return chunk;
    }

    /**
     * Return null to indicate that the standard /v1/models endpoint should be used.
     * Generic backends do not have a native model listing API.
     */
    async listModels(_baseUrl: string): Promise<ModelInfo[] | null> {
        return null;
    }

    /**
     * No default models for the generic backend.
     * All model metadata must come from the server's /v1/models response.
     */
    getDefaultModels(): ModelInfo[] {
        return [];
    }
}
