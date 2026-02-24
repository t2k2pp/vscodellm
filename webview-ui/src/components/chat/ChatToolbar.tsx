/**
 * ChatToolbar -- toolbar above the input area with mode toggle and model selector.
 *
 * Shows:
 * - Plan/Fast mode toggle buttons
 * - Model dropdown selector
 * - File attachment button (placeholder for Feature 4)
 */

import React, { useCallback } from 'react';
import { useAppStore } from '../../state/store';
import { postMessage } from '../../vscode';

export const ChatToolbar: React.FC = () => {
    const settings = useAppStore((s) => s.settings);
    const models = useAppStore((s) => s.models);
    const agentMode = settings.agent.agentMode;
    const selectedModelId = settings.provider.modelId;

    const handleModeChange = useCallback(
        (mode: 'plan' | 'fast') => {
            postMessage({
                type: 'updateSettings',
                settings: {
                    agent: {
                        ...settings.agent,
                        agentMode: mode,
                    },
                },
            });
        },
        [settings.agent],
    );

    const handleModelChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            postMessage({
                type: 'updateSettings',
                settings: {
                    provider: {
                        ...settings.provider,
                        modelId: e.target.value,
                    },
                },
            });
        },
        [settings.provider],
    );

    return (
        <div className="chat-toolbar">
            {/* Mode toggle */}
            <div className="chat-toolbar-modes">
                <button
                    className={`chat-toolbar-mode-btn${agentMode === 'fast' ? ' chat-toolbar-mode-btn--active' : ''}`}
                    onClick={() => handleModeChange('fast')}
                    title="Fast mode: 即実行（承認なし）"
                >
                    <i className="codicon codicon-zap" />
                    Fast
                </button>
                <button
                    className={`chat-toolbar-mode-btn${agentMode === 'plan' ? ' chat-toolbar-mode-btn--active' : ''}`}
                    onClick={() => handleModeChange('plan')}
                    title="Plan mode: 計画→承認→実行"
                >
                    <i className="codicon codicon-checklist" />
                    Plan
                </button>
            </div>

            {/* Model selector */}
            <div className="chat-toolbar-model">
                <select
                    className="chat-toolbar-model-select"
                    value={selectedModelId}
                    onChange={handleModelChange}
                    title="Select model"
                >
                    {models.length === 0 && (
                        <option value="">No models</option>
                    )}
                    {models.map((model) => (
                        <option key={model.id} value={model.id}>
                            {model.name || model.id}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};
