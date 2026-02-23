/**
 * MessageBubble – displays a single chat message.
 *
 * - Role indicator (You / Agent / System)
 * - Message content with Markdown rendering for assistant messages
 * - Timestamp
 * - Expandable tool call display
 * - Streaming cursor when `message.streaming` is true
 */

import React from 'react';
import type { DisplayMessage } from '../../state/types';
import { StreamingMessage } from './StreamingMessage';
import { ToolCallDisplay } from './ToolCallDisplay';
import { Markdown } from '../common/Markdown';

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
            ) : role === 'assistant' ? (
                <Markdown content={content} />
            ) : (
                <div className="message-content">{content}</div>
            )}

            {/* tool calls */}
            {toolCalls && toolCalls.length > 0 && (
                <ToolCallDisplay toolCalls={toolCalls} />
            )}
        </div>
    );
};
