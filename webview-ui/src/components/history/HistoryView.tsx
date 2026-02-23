import React from 'react';
import { useAppStore } from '../../state/store';
import { postMessage } from '../../vscode';
import { HistoryItem } from './HistoryItem';

export const HistoryView: React.FC = () => {
    const conversations = useAppStore((s) => s.conversations);

    const handleLoad = (id: string) => {
        postMessage({ type: 'loadConversation', conversationId: id });
    };

    const handleDelete = (id: string) => {
        postMessage({ type: 'deleteConversation', conversationId: id });
    };

    const handleNew = () => {
        postMessage({ type: 'newConversation' });
    };

    if (conversations.length === 0) {
        return (
            <div className="placeholder-view">
                <i className="codicon codicon-history" />
                <span>No conversation history yet.</span>
                <button className="btn btn-primary" onClick={handleNew} style={{ marginTop: 12 }}>
                    <i className="codicon codicon-add" /> Start New Chat
                </button>
            </div>
        );
    }

    return (
        <div className="history-view">
            <div className="history-header">
                <h3>Conversations</h3>
                <button className="btn btn-sm" onClick={handleNew} title="New conversation">
                    <i className="codicon codicon-add" />
                </button>
            </div>
            <div className="history-list">
                {conversations.map((conv) => (
                    <HistoryItem
                        key={conv.id}
                        conversation={conv}
                        onLoad={() => handleLoad(conv.id)}
                        onDelete={() => handleDelete(conv.id)}
                    />
                ))}
            </div>
        </div>
    );
};
