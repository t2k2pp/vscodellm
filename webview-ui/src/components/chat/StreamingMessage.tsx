/**
 * StreamingMessage – renders text that is still arriving from the LLM.
 *
 * Displays the current content with a blinking cursor appended at the end
 * to indicate that more text is on its way.
 */

import React from 'react';

interface StreamingMessageProps {
    content: string;
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({ content }) => {
    return (
        <span className="message-content">
            {content}
            <span className="streaming-cursor" aria-label="streaming" />
        </span>
    );
};
