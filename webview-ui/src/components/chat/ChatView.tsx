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
import { ApprovalDialog } from '../approval/ApprovalDialog';

export const ChatView: React.FC = () => {
    const messages = useAppStore((s) => s.messages);
    const agentState = useAppStore((s) => s.agentState);
    const pendingApproval = useAppStore((s) => s.pendingApproval);
    const { sendMessage, cancelTask } = useMessages();

    return (
        <div className="chat-view">
            <MessageList messages={messages} />
            {pendingApproval && <ApprovalDialog approval={pendingApproval} />}
            <InputArea
                onSend={sendMessage}
                onCancel={cancelTask}
                agentState={agentState}
            />
        </div>
    );
};
