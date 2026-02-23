/**
 * Ollama backend adapter.
 *
 * Handles Ollama-specific API quirks:
 * - Default URL: http://localhost:11434
 * - Uses native /api/tags endpoint for richer model metadata
 * - tool_choice 'required' is downgraded to 'auto' (not supported on many Ollama models)
 * - Ollama silently discards tokens beyond context window (no error returned)
 * - Streaming responses may not include usage statistics
 * - Model names use "model:tag" format (e.g., "llama3.2:latest")
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type {
    BackendAdapter,
    CompletionChunk,
    CompletionRequest,
    ModelInfo,
} from '../types.js';

/** Default context windows for well-known Ollama models */
const KNOWN_MODELS: Record<string, Partial<ModelInfo>> = {
    'llama3.2:latest': { contextWindow: 131072, supportsToolCalling: true },
    'llama3.2:1b': { contextWindow: 131072, supportsToolCalling: true },
    'llama3.2:3b': { contextWindow: 131072, supportsToolCalling: true },
    'llama3.1:latest': { contextWindow: 131072, supportsToolCalling: true },
    'llama3.1:8b': { contextWindow: 131072, supportsToolCalling: true },
    'llama3.1:70b': { contextWindow: 131072, supportsToolCalling: true },
    'llama3:latest': { contextWindow: 8192, supportsToolCalling: true },
    'llama3:8b': { contextWindow: 8192, supportsToolCalling: true },
    'llama3:70b': { contextWindow: 8192, supportsToolCalling: true },
    'codellama:latest': { contextWindow: 16384, supportsToolCalling: false },
    'codellama:7b': { contextWindow: 16384, supportsToolCalling: false },
    'codellama:13b': { contextWindow: 16384, supportsToolCalling: false },
    'codellama:34b': { contextWindow: 16384, supportsToolCalling: false },
    'deepseek-coder-v2:latest': { contextWindow: 131072, supportsToolCalling: true },
    'deepseek-coder-v2:16b': { contextWindow: 131072, supportsToolCalling: true },
    'qwen2.5-coder:latest': { contextWindow: 32768, supportsToolCalling: true },
    'qwen2.5-coder:7b': { contextWindow: 32768, supportsToolCalling: true },
    'qwen2.5-coder:14b': { contextWindow: 32768, supportsToolCalling: true },
    'qwen2.5-coder:32b': { contextWindow: 32768, supportsToolCalling: true },
    'qwen2.5:latest': { contextWindow: 32768, supportsToolCalling: true },
    'qwen2.5:7b': { contextWindow: 32768, supportsToolCalling: true },
    'qwen2.5:14b': { contextWindow: 32768, supportsToolCalling: true },
    'qwen2.5:32b': { contextWindow: 32768, supportsToolCalling: true },
    'qwen2.5:72b': { contextWindow: 32768, supportsToolCalling: true },
    'mistral:latest': { contextWindow: 32768, supportsToolCalling: true },
    'mistral:7b': { contextWindow: 32768, supportsToolCalling: true },
    'mixtral:latest': { contextWindow: 32768, supportsToolCalling: true },
    'mixtral:8x7b': { contextWindow: 32768, supportsToolCalling: true },
    'mixtral:8x22b': { contextWindow: 65536, supportsToolCalling: true },
    'gemma2:latest': { contextWindow: 8192, supportsToolCalling: false },
    'gemma2:2b': { contextWindow: 8192, supportsToolCalling: false },
    'gemma2:9b': { contextWindow: 8192, supportsToolCalling: false },
    'gemma2:27b': { contextWindow: 8192, supportsToolCalling: false },
    'phi3:latest': { contextWindow: 4096, supportsToolCalling: false },
    'phi3:mini': { contextWindow: 4096, supportsToolCalling: false },
    'phi3:medium': { contextWindow: 4096, supportsToolCalling: false },
    'starcoder2:latest': { contextWindow: 16384, supportsToolCalling: false },
    'starcoder2:3b': { contextWindow: 16384, supportsToolCalling: false },
    'starcoder2:7b': { contextWindow: 16384, supportsToolCalling: false },
    'starcoder2:15b': { contextWindow: 16384, supportsToolCalling: false },
    'command-r:latest': { contextWindow: 131072, supportsToolCalling: true },
    'command-r-plus:latest': { contextWindow: 131072, supportsToolCalling: true },
};

/**
 * Ollama-specific response type from /api/tags endpoint.
 */
interface OllamaTagsResponse {
    models: OllamaModel[];
}

interface OllamaModel {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
        parent_model: string;
        format: string;
        family: string;
        families: string[] | null;
        parameter_size: string;
        quantization_level: string;
        context_length?: number;
    };
}

export class OllamaBackend implements BackendAdapter {
    // ============================================
    // Request Transformation
    // ============================================

    transformRequest(request: CompletionRequest): CompletionRequest {
        // Ollama quirk: tool_choice 'required' is not supported on many models.
        // Downgrade to 'auto' which is the closest supported equivalent.
        if (request.tool_choice === 'required') {
            return { ...request, tool_choice: 'auto' };
        }
        return request;
    }

    // ============================================
    // Chunk Transformation
    // ============================================

    transformChunk(chunk: CompletionChunk, _originalRequest: CompletionRequest): CompletionChunk {
        // Ollama may not return usage statistics in streaming mode.
        // We pass the chunk through as-is; the consumer should not rely
        // on streaming usage stats being present.
        return chunk;
    }

    // ============================================
    // Model Listing (Native Ollama API)
    // ============================================

    async listModels(baseUrl: string): Promise<ModelInfo[] | null> {
        try {
            const response = await fetch(`${baseUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(10_000),
            });

            if (!response.ok) {
                return null;
            }

            const data = (await response.json()) as OllamaTagsResponse;

            if (!data.models || !Array.isArray(data.models)) {
                return null;
            }

            return data.models.map((m) => this._mapOllamaModel(m));
        } catch {
            // If the Ollama native endpoint fails, return null to fall back
            // to the standard /v1/models endpoint.
            return null;
        }
    }

    // ============================================
    // Default Model Metadata
    // ============================================

    getDefaultModels(): ModelInfo[] {
        return Object.entries(KNOWN_MODELS).map(([id, info]) => ({
            id,
            name: id,
            contextWindow: info.contextWindow ?? 4096,
            supportsToolCalling: info.supportsToolCalling ?? true,
            supportsStreaming: true,
        }));
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * Map an Ollama model response to our ModelInfo format.
     */
    private _mapOllamaModel(model: OllamaModel): ModelInfo {
        const known = KNOWN_MODELS[model.name];
        const contextWindow =
            model.details?.context_length ??
            known?.contextWindow ??
            this._estimateContextWindow(model);

        return {
            id: model.name,
            name: model.name,
            contextWindow,
            supportsToolCalling: known?.supportsToolCalling ?? this._checkToolCallSupport(model),
            supportsStreaming: true,
        };
    }

    /**
     * Heuristic to check if a model likely supports tool calling.
     *
     * Strategy:
     * - Models from families known to support tool calling get true
     * - Larger models (7B+) are more likely to support tool calling reliably
     * - When in doubt, return true (XML fallback handles failures)
     */
    private _checkToolCallSupport(model: OllamaModel): boolean {
        const family = model.details?.family?.toLowerCase() ?? '';
        const families = model.details?.families?.map((f) => f.toLowerCase()) ?? [];
        const allFamilies = [family, ...families];

        // Families with known good tool calling support
        const toolCallingFamilies = ['llama', 'qwen2', 'mistral', 'command-r', 'deepseek'];
        if (allFamilies.some((f) => toolCallingFamilies.some((tcf) => f.includes(tcf)))) {
            return true;
        }

        // Families with known poor/no tool calling support
        const noToolCallingFamilies = ['gemma', 'phi', 'starcoder'];
        if (allFamilies.some((f) => noToolCallingFamilies.some((ntf) => f.includes(ntf)))) {
            return false;
        }

        // Default: optimistic. XML fallback handles failures.
        return true;
    }

    /**
     * Estimate context window from parameter size when the API doesn't report it.
     */
    private _estimateContextWindow(model: OllamaModel): number {
        const paramSize = model.details?.parameter_size ?? '';
        const sizeMatch = paramSize.match(/(\d+(\.\d+)?)/);

        if (sizeMatch) {
            const billions = parseFloat(sizeMatch[1]);
            // Larger models tend to support larger context windows in newer architectures,
            // but we use conservative defaults.
            if (billions >= 70) return 8192;
            if (billions >= 13) return 8192;
            if (billions >= 7) return 4096;
        }

        return 4096;
    }
}
