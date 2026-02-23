/**
 * TokenUsageDisplay – shows current token usage and context budget.
 *
 * Displays a compact bar showing how much of the context window is used,
 * plus detailed token counts. Only shown when settings.ui.showTokenCount is true.
 */

import React from 'react';
import { useAppStore } from '../../state/store';

export const TokenUsageDisplay: React.FC = () => {
    const tokenUsage = useAppStore((s) => s.tokenUsage);
    const showTokenCount = useAppStore((s) => s.settings.ui.showTokenCount);

    if (!showTokenCount || !tokenUsage) return null;

    const { promptTokens, completionTokens, totalTokens, contextBudget, contextUsedPercent } = tokenUsage;

    const barColor =
        contextUsedPercent >= 90
            ? 'var(--vscode-testing-iconFailed, #f14c4c)'
            : contextUsedPercent >= 70
              ? 'var(--vscode-inputValidation-warningBorder, #cca700)'
              : 'var(--vscode-progressBar-background, #0078d4)';

    return (
        <div className="token-usage">
            <div className="token-usage-bar">
                <div
                    className="token-usage-bar-fill"
                    style={{
                        width: `${Math.min(contextUsedPercent, 100)}%`,
                        backgroundColor: barColor,
                    }}
                />
            </div>
            <div className="token-usage-text">
                <span title={`Prompt: ${promptTokens.toLocaleString()} | Completion: ${completionTokens.toLocaleString()}`}>
                    {totalTokens.toLocaleString()} / {contextBudget.toLocaleString()} tokens
                </span>
                <span className="token-usage-percent">
                    ({Math.round(contextUsedPercent)}%)
                </span>
            </div>
        </div>
    );
};
