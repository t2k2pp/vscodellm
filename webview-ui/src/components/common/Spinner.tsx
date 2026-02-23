import React from 'react';

export const Spinner: React.FC<{ size?: number; text?: string }> = ({ size = 16, text }) => (
    <span className="spinner-inline">
        <i
            className="codicon codicon-loading codicon-modifier-spin"
            style={{ fontSize: size }}
        />
        {text && <span style={{ marginLeft: 6 }}>{text}</span>}
    </span>
);
