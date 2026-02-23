/**
 * Provider Registry.
 *
 * Manages LLM provider instances. Handles:
 * - Registration of providers from configuration
 * - Backend adapter factory (maps BackendType to adapter instances)
 * - Provider lookup by ID
 * - Active provider management
 * - Model discovery delegation
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

import type { BackendType } from '../../types/messages.js';
import type { LlmProvider } from './LlmProvider.js';
import type { BackendAdapter, ModelInfo, ProviderConfig } from './types.js';
import { OpenAiCompatibleProvider } from './OpenAiCompatibleProvider.js';
import { OllamaBackend } from './backends/OllamaBackend.js';
import { LmStudioBackend } from './backends/LmStudioBackend.js';
import { LlamaCppBackend } from './backends/LlamaCppBackend.js';
import { VllmBackend } from './backends/VllmBackend.js';
import { GenericBackend } from './backends/GenericBackend.js';

export class ProviderRegistry {
    private readonly _providers = new Map<string, LlmProvider>();
    private _activeProviderId: string | null = null;

    // ============================================
    // Provider Registration
    // ============================================

    /**
     * Register a new provider from configuration.
     * Creates an OpenAiCompatibleProvider with the appropriate backend adapter.
     *
     * If a provider with the same ID already exists, it is disposed and replaced.
     *
     * @param config - Provider configuration
     * @returns The created LlmProvider instance
     */
    register(config: ProviderConfig): LlmProvider {
        // Dispose existing provider with the same ID
        const existing = this._providers.get(config.id);
        if (existing) {
            existing.dispose();
        }

        const backend = this.createBackend(config.backendType);
        const provider = new OpenAiCompatibleProvider(config, backend);
        this._providers.set(config.id, provider);

        // If this is the first provider or no active provider is set, make it active
        if (this._activeProviderId === null) {
            this._activeProviderId = config.id;
        }

        return provider;
    }

    /**
     * Unregister and dispose a provider by ID.
     *
     * @param id - Provider ID to remove
     * @returns true if the provider was found and removed
     */
    unregister(id: string): boolean {
        const provider = this._providers.get(id);
        if (!provider) {
            return false;
        }

        provider.dispose();
        this._providers.delete(id);

        // Clear active provider if it was the one removed
        if (this._activeProviderId === id) {
            // Set to first remaining provider, or null
            const firstKey = this._providers.keys().next().value;
            this._activeProviderId = firstKey ?? null;
        }

        return true;
    }

    // ============================================
    // Provider Lookup
    // ============================================

    /**
     * Get a provider by its ID.
     *
     * @param id - Provider ID
     * @returns The provider instance, or undefined if not found
     */
    get(id: string): LlmProvider | undefined {
        return this._providers.get(id);
    }

    /**
     * Get the currently active provider.
     *
     * @throws Error if no provider is registered or active
     */
    getActive(): LlmProvider {
        if (this._activeProviderId === null) {
            throw new Error('No active LLM provider. Configure a provider in settings.');
        }

        const provider = this._providers.get(this._activeProviderId);
        if (!provider) {
            throw new Error(
                `Active provider "${this._activeProviderId}" not found. ` +
                'It may have been removed. Configure a provider in settings.'
            );
        }

        return provider;
    }

    /**
     * Set the active provider by ID.
     *
     * @param id - Provider ID to activate
     * @throws Error if the provider ID is not registered
     */
    setActive(id: string): void {
        if (!this._providers.has(id)) {
            throw new Error(`Provider "${id}" is not registered`);
        }
        this._activeProviderId = id;
    }

    /**
     * Get the ID of the currently active provider, or null if none.
     */
    get activeProviderId(): string | null {
        return this._activeProviderId;
    }

    /**
     * Check whether any providers are registered.
     */
    get hasProviders(): boolean {
        return this._providers.size > 0;
    }

    /**
     * Get all registered provider IDs.
     */
    getProviderIds(): string[] {
        return Array.from(this._providers.keys());
    }

    // ============================================
    // Model Discovery
    // ============================================

    /**
     * Discover available models for a specific provider.
     *
     * @param providerId - ID of the provider to query
     * @returns Array of available models, or empty array if provider not found
     */
    async discoverModels(providerId: string): Promise<ModelInfo[]> {
        const provider = this._providers.get(providerId);
        if (!provider) {
            return [];
        }
        return provider.listModels();
    }

    // ============================================
    // Backend Factory
    // ============================================

    /**
     * Create a BackendAdapter instance for the given backend type.
     *
     * Maps BackendType enum values to their corresponding adapter classes.
     * Falls back to GenericBackend for unknown types.
     *
     * @param backendType - The backend type identifier
     * @returns A BackendAdapter instance
     */
    createBackend(backendType: BackendType): BackendAdapter {
        switch (backendType) {
            case 'ollama':
                return new OllamaBackend();

            case 'lmstudio':
                return new LmStudioBackend();

            case 'llamacpp':
                return new LlamaCppBackend();

            case 'vllm':
                return new VllmBackend();

            case 'generic':
            default:
                return new GenericBackend();
        }
    }

    // ============================================
    // Lifecycle
    // ============================================

    /**
     * Dispose all registered providers and clear the registry.
     */
    dispose(): void {
        for (const [, provider] of this._providers) {
            provider.dispose();
        }
        this._providers.clear();
        this._activeProviderId = null;
    }
}
