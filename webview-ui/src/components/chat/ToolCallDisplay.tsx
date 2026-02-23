import React, { useState } from 'react';
import type { ToolCallDisplay as ToolCallData } from '../../state/types';
import { Spinner } from '../common/Spinner';

interface ToolCallDisplayProps {
    toolCalls: ToolCallData[];
}

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ toolCalls }) => {
    return (
        <div className="tool-calls">
            {toolCalls.map((tc) => (
                <ToolCallItem key={tc.id} toolCall={tc} />
            ))}
        </div>
    );
};

const ToolCallItem: React.FC<{ toolCall: ToolCallData }> = ({ toolCall }) => {
    const [expanded, setExpanded] = useState(false);

    const statusIcon =
        toolCall.status === 'running'
            ? 'codicon-loading codicon-modifier-spin'
            : toolCall.status === 'completed'
              ? 'codicon-check'
              : toolCall.status === 'failed'
                ? 'codicon-error'
                : 'codicon-circle-outline';

    const statusClass =
        toolCall.status === 'completed'
            ? 'tool-call--success'
            : toolCall.status === 'failed'
              ? 'tool-call--error'
              : '';

    return (
        <div className={`tool-call ${statusClass}`}>
            <div className="tool-call-header" onClick={() => setExpanded(!expanded)}>
                <i className={`codicon ${statusIcon}`} />
                <span className="tool-call-name">{toolCall.name}</span>
                {toolCall.status === 'running' && <Spinner size={12} />}
                <i className={`codicon ${expanded ? 'codicon-chevron-up' : 'codicon-chevron-down'}`} style={{ marginLeft: 'auto' }} />
            </div>
            {expanded && (
                <div className="tool-call-details">
                    <div className="tool-call-section">
                        <strong>Arguments:</strong>
                        <pre>{formatJson(toolCall.arguments)}</pre>
                    </div>
                    {toolCall.result && (
                        <div className="tool-call-section">
                            <strong>Result:</strong>
                            <pre>{truncate(toolCall.result, 500)}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

function formatJson(jsonStr: string): string {
    try {
        return JSON.stringify(JSON.parse(jsonStr), null, 2);
    } catch {
        return jsonStr;
    }
}

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '...' : text;
}
