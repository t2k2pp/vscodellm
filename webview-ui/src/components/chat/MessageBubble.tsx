/**
 * MessageBubble – displays a single chat message.
 *
 * - Role indicator (You / Agent / System)
 * - Message content (plain text; Markdown rendering deferred to Phase 6)
 * - Timestamp
 * - List of tool calls, if any
 * - Streaming cursor when `message.streaming` is true
 */

import React from 'react';
import type { DisplayMessage } from '../../state/types';
import { StreamingMessage } from './StreamingMessage';

interface MessageBubbleProps {
    message: DisplayMessage;
}

// ---- helpers ---------------------------------------------------------------

function roleLabel(role: DisplayMessage['role']): string {
    switch (role) {
        case 'user':
            return 'You';
        case 'assistant':
            return 'Agent';
        case 'system':
            return 'System';
    }
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function toolCallIcon(status: string): string {
    switch (status) {
        case 'running':
            return 'codicon-loading codicon-modifier-spin';
        case 'completed':
            return 'codicon-check';
        case 'failed':
            return 'codicon-error';
        default:
            return 'codicon-circle-outline';
    }
}

// ---- component -------------------------------------------------------------

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
    const { role, content, toolCalls, timestamp, streaming } = message;

    return (
        <div className={`message-bubble message-bubble--${role}`}>
            {/* header (skip for system messages – they are minimal) */}
            {role !== 'system' && (
                <div className="message-header">
                    <span className="message-role">{roleLabel(role)}</span>
                    <span className="message-timestamp">{formatTime(timestamp)}</span>
                </div>
            )}

            {/* content */}
            {streaming ? (
                <StreamingMessage content={content} />
            ) : (
                <div className="message-content">{content}</div>
            )}

            {/* tool calls */}
            {toolCalls && toolCalls.length > 0 && (
                <div className="tool-calls">
                    {toolCalls.map((tc) => (
                        <div
                            key={tc.id}
                            className={`tool-call-item tool-call-item--${tc.status}`}
                        >
                            <i className={`codicon ${toolCallIcon(tc.status)}`} />
                            <span className="tool-call-name">{tc.name}</span>
                            <span className="tool-call-status">{tc.status}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
