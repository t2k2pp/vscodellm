/**
 * ModelSelector -- model selection sub-component.
 *
 * Shows a dropdown of available models fetched from the provider, a
 * refresh button with a loading spinner, and context window information
 * when available.  When no provider is connected, an empty-state hint
 * is shown instead.
 */

import React, { useCallback } from 'react';
import type { ModelListItem } from '../../state/types';

// ---- props -------------------------------------------------------------------

interface ModelSelectorProps {
    models: ModelListItem[];
    selectedModelId: string;
    isConnected: boolean;
    isLoading: boolean;
    onModelChange: (modelId: string) => void;
    onRefresh: () => void;
}

// ---- helpers -----------------------------------------------------------------

function formatContextWindow(tokens: number): string {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
    }
    if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(0)}K tokens`;
    }
    return `${tokens} tokens`;
}

// ---- component ---------------------------------------------------------------

export const ModelSelector: React.FC<ModelSelectorProps> = ({
    models,
    selectedModelId,
    isConnected,
    isLoading,
    onModelChange,
    onRefresh,
}) => {
    const handleModelChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onModelChange(e.target.value);
        },
        [onModelChange],
    );

    // Find the currently selected model to display extra info.
    const selectedModel = models.find((m) => m.id === selectedModelId);

    // ---- empty state ---------------------------------------------------------

    if (!isConnected && models.length === 0) {
        return (
            <div className="settings-section">
                <h3 className="settings-section-title">
                    <i className="codicon codicon-symbol-class" />
                    Model Selection
                </h3>
                <div className="settings-empty-state">
                    <i className="codicon codicon-info" />
                    <span>Connect to a provider to see available models</span>
                </div>
            </div>
        );
    }

    // ---- connected state -----------------------------------------------------

    return (
        <div className="settings-section">
            <h3 className="settings-section-title">
                <i className="codicon codicon-symbol-class" />
                Model Selection
            </h3>

            <div className="settings-field">
                <label className="settings-label" htmlFor="model-select">
                    Model
                </label>
                <div className="settings-field-row">
                    <select
                        id="model-select"
                        className="settings-select settings-select--flex"
                        value={selectedModelId}
                        onChange={handleModelChange}
                        disabled={isLoading || models.length === 0}
                    >
                        {models.length === 0 && (
                            <option value="">No models available</option>
                        )}
                        {models.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.name || model.id}
                            </option>
                        ))}
                    </select>
                    <button
                        className="btn-icon settings-refresh-btn"
                        onClick={onRefresh}
                        disabled={isLoading}
                        title="Refresh model list"
                        aria-label="Refresh model list"
                    >
                        <i
                            className={`codicon ${
                                isLoading
                                    ? 'codicon-loading codicon-modifier-spin'
                                    : 'codicon-refresh'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {selectedModel?.contextWindow && (
                <div className="settings-model-info">
                    <i className="codicon codicon-window" />
                    <span>Context window: {formatContextWindow(selectedModel.contextWindow)}</span>
                </div>
            )}
        </div>
    );
};
