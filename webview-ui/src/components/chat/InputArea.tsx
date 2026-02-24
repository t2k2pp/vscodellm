/**
 * InputArea – message composition area at the bottom of the chat.
 *
 * - Auto-growing textarea (up to ~8 lines / 180 px).
 * - Send on Enter (Shift+Enter inserts a newline).
 * - Send button disabled while agent is busy.
 * - Cancel button shown while agent is thinking / executing tools.
 */

import React, { useCallback, useRef, useState } from 'react';
import type { AgentState } from '../../state/types';

interface InputAreaProps {
    onSend: (text: string) => void;
    onCancel: () => void;
    agentState: AgentState;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend, onCancel, agentState }) => {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isBusy = agentState === 'thinking' || agentState === 'executing_tools' || agentState === 'waiting_approval';

    // ---- helpers -----------------------------------------------------------

    /** Auto-resize the textarea to fit content (up to max-height set in CSS). */
    const autoResize = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
    }, []);

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || isBusy) return;
        onSend(trimmed);
        setText('');
        // Reset height after clearing.
        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        });
    }, [text, isBusy, onSend]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // IME変換中（日本語入力など）のEnterは無視する
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend],
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setText(e.target.value);
            autoResize();
        },
        [autoResize],
    );

    // ---- render ------------------------------------------------------------

    return (
        <div className="input-area">
            <textarea
                ref={textareaRef}
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={isBusy ? 'Agent is working...' : 'メッセージを入力... (Enter で送信)'}
                disabled={isBusy}
                rows={3}
                aria-label="Chat message input"
            />
            <div className="input-actions">
                {isBusy ? (
                    <button
                        className="btn-secondary"
                        onClick={onCancel}
                        title="Cancel current task"
                        aria-label="Cancel"
                    >
                        <i className="codicon codicon-debug-stop" />
                    </button>
                ) : (
                    <button
                        className="btn-primary input-send-btn"
                        onClick={handleSend}
                        disabled={!text.trim()}
                        title="Send message"
                        aria-label="Send"
                    >
                        <i className="codicon codicon-send" />
                        Send
                    </button>
                )}
            </div>
        </div>
    );
};
