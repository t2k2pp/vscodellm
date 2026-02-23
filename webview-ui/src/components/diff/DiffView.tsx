import React from 'react';

interface DiffViewProps {
    diff: string;
    filePath?: string;
}

/**
 * Renders a unified diff with syntax coloring.
 * Lines starting with + are additions, - are removals, @@ are hunks.
 */
export const DiffView: React.FC<DiffViewProps> = ({ diff, filePath }) => {
    const lines = diff.split('\n');

    return (
        <div className="diff-view">
            {filePath && <div className="diff-file-header">{filePath}</div>}
            <pre className="diff-content">
                {lines.map((line, i) => {
                    let className = 'diff-line';
                    if (line.startsWith('+') && !line.startsWith('+++')) {
                        className += ' diff-line--added';
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                        className += ' diff-line--removed';
                    } else if (line.startsWith('@@')) {
                        className += ' diff-line--hunk';
                    }
                    return (
                        <div key={i} className={className}>
                            {line}
                        </div>
                    );
                })}
            </pre>
        </div>
    );
};
