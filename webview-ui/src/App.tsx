/**
 * App – root component with tab navigation.
 *
 * Three views: Chat (default), History, Settings.
 * The extension state subscription is initialised here so that every
 * child component can read from the Zustand store.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useExtensionState } from './hooks/useExtensionState';
import { ChatView } from './components/chat/ChatView';
import { SettingsView } from './components/settings/SettingsView';
import { HistoryView } from './components/history/HistoryView';
import { useAppStore } from './state/store';

// ---- tab definition -------------------------------------------------------

type TabId = 'chat' | 'history' | 'settings';

interface TabDef {
    id: TabId;
    label: string;
    icon: string;
}

const tabs: TabDef[] = [
    { id: 'chat', label: 'Chat', icon: 'codicon-comment-discussion' },
    { id: 'history', label: 'History', icon: 'codicon-history' },
    { id: 'settings', label: 'Settings', icon: 'codicon-gear' },
];

// ---- status toast (auto-dismissing notification) --------------------------

const TOAST_DURATION_MS = 5000;

const StatusToast: React.FC = () => {
    const isConnected = useAppStore((s) => s.isConnected);
    const agentState = useAppStore((s) => s.agentState);
    const errorMessage = useAppStore((s) => s.errorMessage);

    const [visible, setVisible] = useState(false);
    const [text, setText] = useState('');
    const [icon, setIcon] = useState('');
    const [variant, setVariant] = useState<'info' | 'error' | 'working'>('info');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Show toast on state changes
    useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        if (errorMessage) {
            setText(errorMessage);
            setIcon('codicon-error');
            setVariant('error');
            setVisible(true);
            timerRef.current = setTimeout(() => setVisible(false), TOAST_DURATION_MS * 2);
        } else if (agentState === 'thinking') {
            setText('Thinking...');
            setIcon('codicon-loading codicon-modifier-spin');
            setVariant('working');
            setVisible(true);
            // Don't auto-dismiss while working
        } else if (agentState === 'executing_tools') {
            setText('Executing tools...');
            setIcon('codicon-loading codicon-modifier-spin');
            setVariant('working');
            setVisible(true);
        } else if (agentState === 'waiting_approval') {
            setText('Waiting for approval');
            setIcon('codicon-shield');
            setVariant('info');
            setVisible(true);
        } else {
            // idle / connected / normal state → dismiss
            setVisible(false);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [errorMessage, agentState, isConnected]);

    if (!visible) return null;

    return (
        <div className={`status-toast status-toast--${variant}`}>
            <i className={`codicon ${icon}`} />
            <span className="status-toast-text">{text}</span>
            <button
                className="status-toast-close"
                onClick={() => setVisible(false)}
                aria-label="Dismiss"
            >
                <i className="codicon codicon-close" />
            </button>
        </div>
    );
};

// ---- root -----------------------------------------------------------------

export function App() {
    // Activate the extension host message bridge.
    useExtensionState();

    const [activeTab, setActiveTab] = useState<TabId>('chat');

    return (
        <div className="app-container">
            {/* Navigation tabs */}
            <div className="nav-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`nav-tab${activeTab === tab.id ? ' nav-tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                        aria-selected={activeTab === tab.id}
                        role="tab"
                    >
                        <i className={`codicon ${tab.icon}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Status toast (overlays the content area) */}
            <StatusToast />

            {/* Active view */}
            <div className="app-content">
                {activeTab === 'chat' && <ChatView />}
                {activeTab === 'history' && <HistoryView />}
                {activeTab === 'settings' && <SettingsView />}
            </div>
        </div>
    );
}
