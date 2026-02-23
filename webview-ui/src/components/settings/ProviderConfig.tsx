/**
 * ProviderConfig -- provider configuration sub-component.
 *
 * Renders backend type selector, base URL input with smart defaults,
 * and an API key password field.  All changes are held in local state
 * via the parent (SettingsView); nothing is sent to the extension host
 * until the user explicitly saves.
 */

import React, { useCallback } from 'react';
import type { BackendType } from '../../state/types';

// ---- default URLs per backend ------------------------------------------------

const BACKEND_DEFAULTS: Record<BackendType, string> = {
    ollama: 'http://localhost:11434',
    lmstudio: 'http://localhost:1234',
    llamacpp: 'http://localhost:8080',
    vllm: 'http://localhost:8000',
    generic: '',
};

const BACKEND_LABELS: Record<BackendType, string> = {
    ollama: 'Ollama',
    lmstudio: 'LM Studio',
    llamacpp: 'llama.cpp',
    vllm: 'vLLM',
    generic: 'Generic OpenAI-compatible',
};

const BACKEND_OPTIONS: BackendType[] = ['ollama', 'lmstudio', 'llamacpp', 'vllm', 'generic'];

// ---- props -------------------------------------------------------------------

interface ProviderConfigProps {
    backendType: BackendType;
    baseUrl: string;
    apiKey: string;
    onBackendChange: (backend: BackendType) => void;
    onBaseUrlChange: (url: string) => void;
    onApiKeyChange: (key: string) => void;
}

// ---- component ---------------------------------------------------------------

export const ProviderConfig: React.FC<ProviderConfigProps> = ({
    backendType,
    baseUrl,
    apiKey,
    onBackendChange,
    onBaseUrlChange,
    onApiKeyChange,
}) => {
    const handleBackendChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newBackend = e.target.value as BackendType;
            onBackendChange(newBackend);

            // Auto-fill the default URL for the selected backend, unless the
            // user picked "generic" (which has no canonical default).
            const defaultUrl = BACKEND_DEFAULTS[newBackend];
            if (newBackend !== 'generic') {
                onBaseUrlChange(defaultUrl);
            }
        },
        [onBackendChange, onBaseUrlChange],
    );

    const handleBaseUrlChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onBaseUrlChange(e.target.value);
        },
        [onBaseUrlChange],
    );

    const handleApiKeyChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onApiKeyChange(e.target.value);
        },
        [onApiKeyChange],
    );

    return (
        <div className="settings-section">
            <h3 className="settings-section-title">
                <i className="codicon codicon-server" />
                Provider Configuration
            </h3>

            <div className="settings-field">
                <label className="settings-label" htmlFor="backend-type">
                    Backend Type
                </label>
                <select
                    id="backend-type"
                    className="settings-select"
                    value={backendType}
                    onChange={handleBackendChange}
                >
                    {BACKEND_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                            {BACKEND_LABELS[opt]}
                        </option>
                    ))}
                </select>
            </div>

            <div className="settings-field">
                <label className="settings-label" htmlFor="base-url">
                    Base URL
                </label>
                <input
                    id="base-url"
                    type="text"
                    className="settings-input"
                    value={baseUrl}
                    onChange={handleBaseUrlChange}
                    placeholder={BACKEND_DEFAULTS[backendType] || 'http://localhost:8080'}
                />
            </div>

            <div className="settings-field">
                <label className="settings-label" htmlFor="api-key">
                    API Key
                </label>
                <input
                    id="api-key"
                    type="password"
                    className="settings-input"
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    placeholder="Usually not needed for local servers"
                />
                <span className="settings-hint">
                    Most local servers (Ollama, LM Studio, llama.cpp) do not require an API key.
                </span>
            </div>
        </div>
    );
};
