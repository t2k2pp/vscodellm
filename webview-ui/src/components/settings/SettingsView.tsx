/**
 * SettingsView -- full settings panel.
 *
 * Contains three sections:
 *   1. Provider Configuration (backend type, base URL, API key)
 *   2. Model Selection (test connection, model dropdown, refresh)
 *   3. Agent Settings (temperature, max iterations)
 *
 * All form changes are held in local component state and only sent to
 * the extension host when the user clicks "Save Settings".
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import { useMessages } from '../../hooks/useMessages';
import { postMessage } from '../../vscode';
import type { BackendType, ExtensionSettings } from '../../state/types';
import { ProviderConfig } from './ProviderConfig';
import { ModelSelector } from './ModelSelector';

// ---- connection status type --------------------------------------------------

type ConnectionTestStatus = 'idle' | 'testing' | 'connected' | 'failed';

// ---- component ---------------------------------------------------------------

export const SettingsView: React.FC = () => {
    // ---- store subscriptions -------------------------------------------------
    const storeSettings = useAppStore((s) => s.settings);
    const isConnected = useAppStore((s) => s.isConnected);
    const models = useAppStore((s) => s.models);
    const errorMessage = useAppStore((s) => s.errorMessage);

    const { testConnection, listModels } = useMessages();

    // ---- local form state (mirror of store, only sent on Save) ---------------
    const [backendType, setBackendType] = useState<BackendType>(storeSettings.provider.backendType);
    const [baseUrl, setBaseUrl] = useState(storeSettings.provider.baseUrl);
    const [apiKey, setApiKey] = useState(storeSettings.provider.apiKey);
    const [selectedModelId, setSelectedModelId] = useState(storeSettings.provider.modelId);
    const [temperature, setTemperature] = useState(storeSettings.agent.temperature);
    const [maxIterations, setMaxIterations] = useState(storeSettings.agent.maxIterations);

    // ---- transient UI state --------------------------------------------------
    const [connectionStatus, setConnectionStatus] = useState<ConnectionTestStatus>(
        isConnected ? 'connected' : 'idle',
    );
    const [modelsLoading, setModelsLoading] = useState(false);
    const [saveFlash, setSaveFlash] = useState(false);

    // ---- sync from store when settings change externally ---------------------
    useEffect(() => {
        setBackendType(storeSettings.provider.backendType);
        setBaseUrl(storeSettings.provider.baseUrl);
        setApiKey(storeSettings.provider.apiKey);
        setSelectedModelId(storeSettings.provider.modelId);
        setTemperature(storeSettings.agent.temperature);
        setMaxIterations(storeSettings.agent.maxIterations);
    }, [storeSettings]);

    // ---- watch isConnected from extension host to update connection badge ----
    useEffect(() => {
        if (isConnected) {
            setConnectionStatus('connected');
        }
    }, [isConnected]);

    // ---- watch errorMessage for failed connection ----------------------------
    useEffect(() => {
        if (errorMessage && connectionStatus === 'testing') {
            setConnectionStatus('failed');
        }
    }, [errorMessage, connectionStatus]);

    // ---- watch models list to stop loading spinner --------------------------
    useEffect(() => {
        if (modelsLoading && models.length >= 0) {
            setModelsLoading(false);
        }
        // Auto-select the first model if none is selected but models are available.
        if (models.length > 0 && !selectedModelId) {
            setSelectedModelId(models[0].id);
        }
    }, [models]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- handlers ------------------------------------------------------------

    const handleTestConnection = useCallback(() => {
        // First save provider settings so the extension host tests the right URL.
        postMessage({
            type: 'updateSettings',
            settings: {
                provider: {
                    id: 'default',
                    backendType,
                    baseUrl,
                    apiKey,
                    modelId: selectedModelId,
                },
            },
        });
        setConnectionStatus('testing');
        testConnection();
    }, [backendType, baseUrl, apiKey, selectedModelId, testConnection]);

    const handleRefreshModels = useCallback(() => {
        // Save provider settings first so the extension host hits the right endpoint.
        postMessage({
            type: 'updateSettings',
            settings: {
                provider: {
                    id: 'default',
                    backendType,
                    baseUrl,
                    apiKey,
                    modelId: selectedModelId,
                },
            },
        });
        setModelsLoading(true);
        listModels();
    }, [backendType, baseUrl, apiKey, selectedModelId, listModels]);

    const handleTemperatureChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setTemperature(parseFloat(e.target.value));
        },
        [],
    );

    const handleMaxIterationsChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                setMaxIterations(Math.min(100, Math.max(1, val)));
            }
        },
        [],
    );

    const handleSave = useCallback(() => {
        const updatedSettings: Partial<ExtensionSettings> = {
            provider: {
                id: 'default',
                backendType,
                baseUrl,
                apiKey,
                modelId: selectedModelId,
            },
            agent: {
                ...storeSettings.agent,
                temperature,
                maxIterations,
            },
        };
        postMessage({ type: 'updateSettings', settings: updatedSettings });

        // Brief visual feedback for the save.
        setSaveFlash(true);
        setTimeout(() => setSaveFlash(false), 1500);
    }, [backendType, baseUrl, apiKey, selectedModelId, temperature, maxIterations, storeSettings.agent]);

    // ---- derived values ------------------------------------------------------

    const connectionBadgeClass =
        connectionStatus === 'connected'
            ? 'settings-connection-badge--connected'
            : connectionStatus === 'failed'
              ? 'settings-connection-badge--failed'
              : connectionStatus === 'testing'
                ? 'settings-connection-badge--testing'
                : 'settings-connection-badge--idle';

    const connectionLabel =
        connectionStatus === 'connected'
            ? 'Connected'
            : connectionStatus === 'failed'
              ? 'Connection failed'
              : connectionStatus === 'testing'
                ? 'Testing...'
                : 'Not connected';

    // ---- render --------------------------------------------------------------

    return (
        <div className="settings-view">
            <div className="settings-scroll">
                {/* ---- Provider Configuration ---- */}
                <ProviderConfig
                    backendType={backendType}
                    baseUrl={baseUrl}
                    apiKey={apiKey}
                    onBackendChange={setBackendType}
                    onBaseUrlChange={setBaseUrl}
                    onApiKeyChange={setApiKey}
                />

                {/* ---- Connection Test ---- */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        <i className="codicon codicon-plug" />
                        Connection
                    </h3>

                    <div className="settings-field-row settings-connection-row">
                        <button
                            className="btn-primary"
                            onClick={handleTestConnection}
                            disabled={connectionStatus === 'testing' || !baseUrl.trim()}
                        >
                            {connectionStatus === 'testing' ? (
                                <>
                                    <i className="codicon codicon-loading codicon-modifier-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <i className="codicon codicon-debug-start" />
                                    Test Connection
                                </>
                            )}
                        </button>

                        <span className={`settings-connection-badge ${connectionBadgeClass}`}>
                            <i
                                className={`codicon ${
                                    connectionStatus === 'connected'
                                        ? 'codicon-check'
                                        : connectionStatus === 'failed'
                                          ? 'codicon-error'
                                          : connectionStatus === 'testing'
                                            ? 'codicon-loading codicon-modifier-spin'
                                            : 'codicon-circle-outline'
                                }`}
                            />
                            {connectionLabel}
                        </span>
                    </div>

                    {connectionStatus === 'failed' && errorMessage && (
                        <div className="settings-error">{errorMessage}</div>
                    )}
                </div>

                {/* ---- Model Selection ---- */}
                <ModelSelector
                    models={models}
                    selectedModelId={selectedModelId}
                    isConnected={connectionStatus === 'connected'}
                    isLoading={modelsLoading}
                    onModelChange={setSelectedModelId}
                    onRefresh={handleRefreshModels}
                />

                {/* ---- Agent Settings ---- */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        <i className="codicon codicon-settings-gear" />
                        Agent Settings
                    </h3>

                    <div className="settings-field">
                        <label className="settings-label" htmlFor="temperature">
                            Temperature
                            <span className="settings-value-display">{temperature.toFixed(1)}</span>
                        </label>
                        <input
                            id="temperature"
                            type="range"
                            className="settings-slider"
                            min="0"
                            max="2"
                            step="0.1"
                            value={temperature}
                            onChange={handleTemperatureChange}
                        />
                        <div className="settings-slider-labels">
                            <span>Precise (0.0)</span>
                            <span>Creative (2.0)</span>
                        </div>
                    </div>

                    <div className="settings-field">
                        <label className="settings-label" htmlFor="max-iterations">
                            Max Iterations
                        </label>
                        <input
                            id="max-iterations"
                            type="number"
                            className="settings-input settings-input--narrow"
                            min="1"
                            max="100"
                            value={maxIterations}
                            onChange={handleMaxIterationsChange}
                        />
                        <span className="settings-hint">
                            Maximum number of agent tool-call iterations per task (1-100).
                        </span>
                    </div>
                </div>

                {/* ---- Save ---- */}
                <div className="settings-actions">
                    <button
                        className={`btn-primary settings-save-btn${saveFlash ? ' settings-save-btn--saved' : ''}`}
                        onClick={handleSave}
                    >
                        <i className={`codicon ${saveFlash ? 'codicon-check' : 'codicon-save'}`} />
                        {saveFlash ? 'Saved!' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};
