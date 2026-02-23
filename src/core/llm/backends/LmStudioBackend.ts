/**
 * LM Studio backend adapter.
 *
 * Handles LM Studio-specific quirks:
 * - Default URL: http://localhost:1234
 * - Uses standard OpenAI-compatible /v1/models and /v1/chat/completions
 * - Model IDs may include full file paths; we normalize the display name
 * - Tool calling support depends on the loaded model
 * - API key is typically not required (use 'lm-studio' or empty)
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type {
    BackendAdapter,
    CompletionChunk,
    CompletionRequest,
    ModelInfo,
} from '../types.js';

export class LmStudioBackend implements BackendAdapter {
    transformRequest(request: CompletionRequest): CompletionRequest {
        // LM Studio supports tool_choice but some models may not handle 'required' well.
        // Downgrade to 'auto' for safety.
        if (request.tool_choice === 'required') {
            return { ...request, tool_choice: 'auto' };
        }
        return request;
    }

    transformChunk(chunk: CompletionChunk, _originalRequest: CompletionRequest): CompletionChunk {
        return chunk;
    }

    /**
     * LM Studio uses the standard /v1/models endpoint.
     * Return null to let OpenAiCompatibleProvider use the default listing.
     */
    async listModels(_baseUrl: string): Promise<ModelInfo[] | null> {
        return null;
    }

    getDefaultModels(): ModelInfo[] {
        // LM Studio models are user-downloaded; no static defaults.
        return [];
    }
}
