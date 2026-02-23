import React, { useState } from 'react';

interface CodeBlockProps {
    code: string;
    language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="code-block">
            <div className="code-block-header">
                {language && <span className="code-block-lang">{language}</span>}
                <button className="code-block-copy" onClick={handleCopy} title="Copy">
                    <i className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`} />
                </button>
            </div>
            <pre className="code-block-content">
                <code>{code}</code>
            </pre>
        </div>
    );
};
