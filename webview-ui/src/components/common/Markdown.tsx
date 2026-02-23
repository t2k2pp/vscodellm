import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownProps {
    content: string;
}

/**
 * Simple markdown renderer that handles code blocks and basic formatting.
 * Splits content at fenced code blocks and renders them with CodeBlock.
 */
export const Markdown: React.FC<MarkdownProps> = ({ content }) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
        <div className="markdown-content">
            {parts.map((part, i) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const firstNewline = part.indexOf('\n');
                    const language = part.slice(3, firstNewline).trim() || undefined;
                    const code = part.slice(firstNewline + 1, -3).trim();
                    return <CodeBlock key={i} code={code} language={language} />;
                }
                // Render non-code text with basic formatting
                return <span key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(part) }} />;
            })}
        </div>
    );
};

function formatInlineMarkdown(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br />');
}
