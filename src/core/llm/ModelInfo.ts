/**
 * ModelInfo helper utilities.
 *
 * Provides default context window sizes per backend, model capability
 * detection, and merging of user overrides with detected capabilities.
 *
 * This module acts as a centralized knowledge base for model metadata
 * that can't always be detected from the LLM server API.
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type { BackendType } from '../../types/messages.js';
import type { ModelInfo } from './types.js';

// ============================================
// Default Context Windows per Backend
// ============================================

/**
 * Default context window sizes when the server doesn't report them.
 * These are conservative defaults to avoid silent context overflow.
 */
const DEFAULT_CONTEXT_WINDOWS: Record<BackendType, number> = {
    ollama: 4096,
    lmstudio: 4096,
    llamacpp: 4096,
    vllm: 4096,
    generic: 4096,
};

// ============================================
// User-Override Model Configuration
// ============================================

/**
 * User-specified overrides for model capabilities.
 * All fields are optional; only specified fields override detected values.
 */
export interface ModelInfoOverride {
    contextWindow?: number;
    supportsToolCalling?: boolean;
    supportsStreaming?: boolean;
}

// ============================================
// ModelInfo Helper Functions
// ============================================

/**
 * Get the default context window for a given backend type.
 *
 * @param backendType - The backend type
 * @returns Default context window in tokens
 */
export function getDefaultContextWindow(backendType: BackendType): number {
    return DEFAULT_CONTEXT_WINDOWS[backendType] ?? 4096;
}

/**
 * Create a ModelInfo with default values for a backend type.
 * Used when model metadata is not available from the server.
 *
 * @param modelId - The model identifier
 * @param backendType - The backend type
 * @returns A ModelInfo with conservative defaults
 */
export function createDefaultModelInfo(modelId: string, backendType: BackendType): ModelInfo {
    return {
        id: modelId,
        name: modelId,
        contextWindow: getDefaultContextWindow(backendType),
        supportsToolCalling: true, // Optimistic; XML fallback handles failures
        supportsStreaming: true,
    };
}

/**
 * Merge detected model info with user-specified overrides.
 *
 * User overrides take precedence over detected values. This allows users
 * to correct incorrect capabilities reported by the server (e.g., an Ollama
 * model that reports a context window of 2048 but actually supports 8192).
 *
 * @param detected - ModelInfo detected from the server
 * @param overrides - User-specified overrides (all fields optional)
 * @returns Merged ModelInfo
 */
export function mergeModelInfo(detected: ModelInfo, overrides: ModelInfoOverride): ModelInfo {
    return {
        id: detected.id,
        name: detected.name,
        contextWindow: overrides.contextWindow ?? detected.contextWindow,
        supportsToolCalling: overrides.supportsToolCalling ?? detected.supportsToolCalling,
        supportsStreaming: overrides.supportsStreaming ?? detected.supportsStreaming,
    };
}

/**
 * Infer model capabilities from the model name/id.
 *
 * This is a best-effort heuristic used when the server doesn't provide
 * capability information. Patterns are matched against the model ID
 * in a case-insensitive manner.
 *
 * @param modelId - The model identifier
 * @returns Partial ModelInfo with inferred capabilities
 */
export function inferModelCapabilities(modelId: string): Partial<ModelInfo> {
    const id = modelId.toLowerCase();
    const info: Partial<ModelInfo> = {};

    // Context window inference from model name patterns
    if (id.includes('llama-3.1') || id.includes('llama3.1') || id.includes('llama-3.2') || id.includes('llama3.2')) {
        info.contextWindow = 131072;
        info.supportsToolCalling = true;
    } else if (id.includes('llama-3') || id.includes('llama3')) {
        info.contextWindow = 8192;
        info.supportsToolCalling = true;
    } else if (id.includes('codellama') || id.includes('code-llama')) {
        info.contextWindow = 16384;
        info.supportsToolCalling = false;
    } else if (id.includes('mistral') || id.includes('mixtral')) {
        info.contextWindow = 32768;
        info.supportsToolCalling = true;
    } else if (id.includes('qwen')) {
        info.contextWindow = 32768;
        info.supportsToolCalling = true;
    } else if (id.includes('deepseek-coder')) {
        info.contextWindow = 131072;
        info.supportsToolCalling = true;
    } else if (id.includes('deepseek')) {
        info.contextWindow = 65536;
        info.supportsToolCalling = true;
    } else if (id.includes('command-r')) {
        info.contextWindow = 131072;
        info.supportsToolCalling = true;
    } else if (id.includes('gemma')) {
        info.contextWindow = 8192;
        info.supportsToolCalling = false;
    } else if (id.includes('phi')) {
        info.contextWindow = 4096;
        info.supportsToolCalling = false;
    } else if (id.includes('starcoder')) {
        info.contextWindow = 16384;
        info.supportsToolCalling = false;
    }

    // Streaming is universally supported
    info.supportsStreaming = true;

    return info;
}

/**
 * Create a ModelInfo by combining server data, name-based inference,
 * and user overrides (in ascending priority order).
 *
 * @param modelId - Model identifier
 * @param serverInfo - Partial info from the server (may be incomplete)
 * @param backendType - Backend type for defaults
 * @param overrides - User-specified overrides
 * @returns Complete ModelInfo
 */
export function resolveModelInfo(
    modelId: string,
    serverInfo: Partial<ModelInfo>,
    backendType: BackendType,
    overrides?: ModelInfoOverride
): ModelInfo {
    // Start with defaults
    const defaults = createDefaultModelInfo(modelId, backendType);

    // Layer 1: Name-based inference
    const inferred = inferModelCapabilities(modelId);

    // Layer 2: Server-provided info
    const resolved: ModelInfo = {
        id: modelId,
        name: serverInfo.name ?? modelId,
        contextWindow: serverInfo.contextWindow ?? inferred.contextWindow ?? defaults.contextWindow,
        supportsToolCalling:
            serverInfo.supportsToolCalling ?? inferred.supportsToolCalling ?? defaults.supportsToolCalling,
        supportsStreaming:
            serverInfo.supportsStreaming ?? inferred.supportsStreaming ?? defaults.supportsStreaming,
    };

    // Layer 3: User overrides (highest priority)
    if (overrides) {
        return mergeModelInfo(resolved, overrides);
    }

    return resolved;
}
