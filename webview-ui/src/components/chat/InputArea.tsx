/**
 * InputArea – message composition area at the bottom of the chat.
 *
 * - Auto-growing textarea (up to ~8 lines / 180 px).
 * - Send on Enter (Shift+Enter inserts a newline).
 * - Send button disabled while agent is busy.
 * - Cancel button shown while agent is thinking / executing tools.
 * - File attachment button with image preview support.
 */

import React, { useCallback, useRef, useState } from 'react';
import type { AgentState } from '../../state/types';

interface Attachment {
    name: string;
    mimeType: string;
    data: string; // base64
    preview?: string; // data URL for image preview
}

interface InputAreaProps {
    onSend: (text: string, attachments?: Attachment[]) => void;
    onCancel: () => void;
    agentState: AgentState;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend, onCancel, agentState }) => {
    const [text, setText] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        if ((!trimmed && attachments.length === 0) || isBusy) return;
        onSend(trimmed, attachments.length > 0 ? attachments : undefined);
        setText('');
        setAttachments([]);
        // Reset height after clearing.
        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        });
    }, [text, attachments, isBusy, onSend]);

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

    const handleFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                const dataUrl = reader.result as string;
                const isImage = file.type.startsWith('image/');

                setAttachments((prev) => [
                    ...prev,
                    {
                        name: file.name,
                        mimeType: file.type,
                        data: base64,
                        preview: isImage ? dataUrl : undefined,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        });

        // Reset input so same file can be selected again
        e.target.value = '';
    }, []);

    const removeAttachment = useCallback((index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // ---- render ------------------------------------------------------------

    return (
        <div className="input-area">
            {/* Attachment previews */}
            {attachments.length > 0 && (
                <div className="input-attachments">
                    {attachments.map((att, i) => (
                        <div key={i} className="input-attachment-item">
                            {att.preview ? (
                                <img src={att.preview} alt={att.name} className="input-attachment-thumb" />
                            ) : (
                                <i className="codicon codicon-file" />
                            )}
                            <span className="input-attachment-name">{att.name}</span>
                            <button
                                className="input-attachment-remove"
                                onClick={() => removeAttachment(i)}
                                aria-label="Remove attachment"
                            >
                                <i className="codicon codicon-close" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="input-row">
                {/* Attach button */}
                <button
                    className="btn-icon input-attach-btn"
                    onClick={handleFileSelect}
                    disabled={isBusy}
                    title="ファイルを添付"
                    aria-label="Attach file"
                >
                    <i className="codicon codicon-attach" />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.txt,.md,.json,.csv,.xml,.yaml,.yml,.log"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />

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
                            disabled={!text.trim() && attachments.length === 0}
                            title="Send message"
                            aria-label="Send"
                        >
                            <i className="codicon codicon-send" />
                            Send
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
