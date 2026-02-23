/**
 * MessageList – scrollable list of all chat messages.
 *
 * User messages are aligned right, assistant messages left, and system
 * messages are centred.  The list auto-scrolls to the bottom whenever a
 * new message appears or the last message is updated (streaming).
 */

import React, { useEffect, useRef } from 'react';
import type { DisplayMessage } from '../../state/types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
    messages: DisplayMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
    const endRef = useRef<HTMLDivElement>(null);

    // Auto-scroll when messages change.
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="message-list-empty">
                <i className="codicon codicon-comment-discussion" />
                <span>No messages yet.</span>
                <span>Type a message below to start a conversation with the agent.</span>
            </div>
        );
    }

    return (
        <div className="message-list">
            {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
            ))}
            {/* Scroll anchor */}
            <div ref={endRef} />
        </div>
    );
};
