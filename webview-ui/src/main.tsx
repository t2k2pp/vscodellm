import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Global and feature-specific styles.
import './styles/global.css';
import './styles/chat.css';
import './styles/components.css';
import './styles/settings.css';

const root = createRoot(document.getElementById('root')!);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
