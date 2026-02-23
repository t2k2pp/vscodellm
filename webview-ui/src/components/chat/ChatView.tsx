/**
 * ChatView – main chat container.
 *
 * Composes the message list, an optional approval dialog, and the input
 * area into a full-height flex column.
 */

import React from 'react';
import { useAppStore } from '../../state/store';
import { useMessages } from '../../hooks/useMessages';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';

// ---- approval dialog (inline, keeps the component file self-contained) ----

const ApprovalDialog: React.FC = () => {
    const pendingApproval = useAppStore((s) => s.pendingApproval);
    const { approveAction, rejectAction } = useMessages();

    if (!pendingApproval) return null;

    const { id, type, description, details } = pendingApproval;

    const detailText =
        details.diff ?? details.command ?? details.path ?? '';

    return (
        <div className="approval-dialog">
            <div className="approval-header">
                <i className="codicon codicon-shield" />
                <span>Approval Required ({type.replace('_', ' ')})</span>
            </div>
            <div className="approval-description">{description}</div>
            {detailText && (
                <pre className="approval-details">{detailText}</pre>
            )}
            <div className="approval-actions">
                <button className="btn-primary" onClick={() => approveAction(id)}>
                    <i className="codicon codicon-check" /> Approve
                </button>
                <button className="btn-secondary" onClick={() => rejectAction(id)}>
                    <i className="codicon codicon-close" /> Reject
                </button>
            </div>
        </div>
    );
};

// ---- main chat view --------------------------------------------------------

export const ChatView: React.FC = () => {
    const messages = useAppStore((s) => s.messages);
    const agentState = useAppStore((s) => s.agentState);
    const { sendMessage, cancelTask } = useMessages();

    return (
        <div className="chat-view">
            <MessageList messages={messages} />
            <ApprovalDialog />
            <InputArea
                onSend={sendMessage}
                onCancel={cancelTask}
                agentState={agentState}
            />
        </div>
    );
};
