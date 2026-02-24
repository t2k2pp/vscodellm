import React from 'react';
import type { ConversationSummary } from '../../state/types';

interface HistoryItemProps {
    conversation: ConversationSummary;
    onLoad: () => void;
    onDelete: () => void;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({ conversation, onLoad, onDelete }) => {
    const timeAgo = formatTimeAgo(conversation.timestamp);

    return (
        <div className="history-item" onClick={onLoad} role="button" tabIndex={0}>
            <div className="history-item-header">
                <span className="history-item-title">{conversation.title}</span>
                <span className="history-item-time">{timeAgo}</span>
            </div>
            <div className="history-item-preview">
                {conversation.lastMessage || 'No messages'}
            </div>
            <div className="history-item-footer">
                <span className="history-item-count">
                    {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
                </span>
                <button
                    className="btn-icon history-delete-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('この会話を削除しますか？')) {
                            onDelete();
                        }
                    }}
                    title="Delete conversation"
                >
                    <i className="codicon codicon-trash" />
                </button>
            </div>
        </div>
    );
};

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
