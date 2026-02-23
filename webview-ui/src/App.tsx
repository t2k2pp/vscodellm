/**
 * App – root component with tab navigation.
 *
 * Three views: Chat (default), History, Settings.
 * The extension state subscription is initialised here so that every
 * child component can read from the Zustand store.
 */

import React, { useState } from 'react';
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

// SettingsView is now a full component in components/settings/SettingsView.tsx

// ---- status bar (connection indicator) ------------------------------------

const StatusBar: React.FC = () => {
    const isConnected = useAppStore((s) => s.isConnected);
    const agentState = useAppStore((s) => s.agentState);
    const errorMessage = useAppStore((s) => s.errorMessage);

    let statusText: string;
    let statusIcon: string;

    if (errorMessage) {
        statusText = errorMessage;
        statusIcon = 'codicon-error';
    } else if (!isConnected) {
        statusText = 'Disconnected';
        statusIcon = 'codicon-debug-disconnect';
    } else {
        switch (agentState) {
            case 'thinking':
                statusText = 'Thinking...';
                statusIcon = 'codicon-loading codicon-modifier-spin';
                break;
            case 'executing_tools':
                statusText = 'Executing tools...';
                statusIcon = 'codicon-loading codicon-modifier-spin';
                break;
            case 'waiting_approval':
                statusText = 'Waiting for approval';
                statusIcon = 'codicon-shield';
                break;
            case 'error':
                statusText = 'Error';
                statusIcon = 'codicon-error';
                break;
            default:
                statusText = 'Ready';
                statusIcon = 'codicon-check';
                break;
        }
    }

    return (
        <div className="status-badge" style={{ margin: '0 12px 0 auto', flexShrink: 0 }}>
            <i className={`codicon ${statusIcon}`} />
            <span>{statusText}</span>
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
                <StatusBar />
            </div>

            {/* Active view */}
            <div className="app-content">
                {activeTab === 'chat' && <ChatView />}
                {activeTab === 'history' && <HistoryView />}
                {activeTab === 'settings' && <SettingsView />}
            </div>
        </div>
    );
}
