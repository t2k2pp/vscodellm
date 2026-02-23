/**
 * Zustand store for the webview UI.
 *
 * Single source of truth for all webview state.  The extension host pushes
 * updates via postMessage; the store's `handleExtensionMessage` method
 * processes each message type and mutates state accordingly.
 */

import { create } from 'zustand';
import type {
    AgentState,
    DisplayMessage,
    ExtensionToWebviewMessage,
    ExtensionSettings,
    PendingApproval,
    ModelListItem,
    ConversationSummary,
    ToolCallDisplay,
    TokenUsageInfo,
} from './types';
import { getDefaultSettings } from './types';

// ------------------------------------------------------------------ types

export interface AppStore {
    // ---- state ---------------------------------------------------------
    messages: DisplayMessage[];
    agentState: AgentState;
    pendingApproval: PendingApproval | null;
    settings: ExtensionSettings;
    isConnected: boolean;
    activeModel: string | null;
    models: ModelListItem[];
    conversations: ConversationSummary[];
    errorMessage: string | null;
    tokenUsage: TokenUsageInfo | null;

    // Streaming accumulator – the content collected while a stream is in
    // progress.  It is folded into the last assistant message on streamEnd.
    _streamingContent: string;

    // ---- actions -------------------------------------------------------
    addMessage: (message: DisplayMessage) => void;
    updateStreamingMessage: (content: string) => void;
    setAgentState: (state: AgentState) => void;
    setPendingApproval: (approval: PendingApproval | null) => void;
    clearMessages: () => void;
    setSettings: (settings: Partial<ExtensionSettings>) => void;
    setConnected: (connected: boolean) => void;
    setError: (error: string | null) => void;

    /** Main dispatcher – call this for every message from the extension host. */
    handleExtensionMessage: (msg: ExtensionToWebviewMessage) => void;
}

// ------------------------------------------------------------------ store

export const useAppStore = create<AppStore>((set, get) => ({
    // ---- initial state -------------------------------------------------
    messages: [],
    agentState: 'idle',
    pendingApproval: null,
    settings: getDefaultSettings(),
    isConnected: false,
    activeModel: null,
    models: [],
    conversations: [],
    errorMessage: null,
    tokenUsage: null,
    _streamingContent: '',

    // ---- actions -------------------------------------------------------

    addMessage: (message) =>
        set((s) => ({ messages: [...s.messages, message] })),

    updateStreamingMessage: (content) =>
        set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant' && last.streaming) {
                msgs[msgs.length - 1] = { ...last, content };
            }
            return { messages: msgs };
        }),

    setAgentState: (agentState) => set({ agentState }),

    setPendingApproval: (pendingApproval) => set({ pendingApproval }),

    clearMessages: () => set({ messages: [] }),

    setSettings: (partial) =>
        set((s) => ({
            settings: { ...s.settings, ...partial } as ExtensionSettings,
        })),

    setConnected: (isConnected) => set({ isConnected }),

    setError: (errorMessage) => set({ errorMessage }),

    // ---- message dispatcher --------------------------------------------

    handleExtensionMessage: (msg) => {
        const state = get();

        switch (msg.type) {
            // ---------- streaming ----------------------------------------
            case 'streamChunk': {
                const newContent = state._streamingContent + msg.content;
                const msgs = [...state.messages];
                const last = msgs[msgs.length - 1];

                if (last && last.role === 'assistant' && last.streaming) {
                    // Update existing streaming message.
                    msgs[msgs.length - 1] = { ...last, content: newContent };
                } else {
                    // First chunk – create a new streaming placeholder.
                    msgs.push({
                        id: `stream-${Date.now()}`,
                        role: 'assistant',
                        content: newContent,
                        timestamp: Date.now(),
                        streaming: true,
                    });
                }
                set({ messages: msgs, _streamingContent: newContent });
                break;
            }

            case 'streamEnd': {
                const msgs = [...state.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.streaming) {
                    msgs[msgs.length - 1] = { ...last, streaming: false };
                }
                set({ messages: msgs, _streamingContent: '' });
                break;
            }

            // ---------- agent lifecycle ----------------------------------
            case 'stateChange':
                set({ agentState: msg.state });
                break;

            // ---------- tool calls ---------------------------------------
            case 'toolCallStarted': {
                const msgs = [...state.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                    const tc: ToolCallDisplay = {
                        id: msg.toolCall.id,
                        name: msg.toolCall.name,
                        arguments: JSON.stringify(msg.toolCall.arguments),
                        status: 'running',
                    };
                    const toolCalls = [...(last.toolCalls ?? []), tc];
                    msgs[msgs.length - 1] = { ...last, toolCalls };
                }
                set({ messages: msgs });
                break;
            }

            case 'toolCallCompleted': {
                const msgs = [...state.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant' && last.toolCalls) {
                    const toolCalls = last.toolCalls.map((tc) =>
                        tc.id === msg.toolCallId
                            ? {
                                  ...tc,
                                  result: msg.result,
                                  status: (msg.success ? 'completed' : 'failed') as ToolCallDisplay['status'],
                              }
                            : tc,
                    );
                    msgs[msgs.length - 1] = { ...last, toolCalls };
                }
                set({ messages: msgs });
                break;
            }

            // ---------- approval -----------------------------------------
            case 'approvalRequired':
                set({ pendingApproval: msg.approval, agentState: 'waiting_approval' });
                break;

            case 'approvalDismissed':
                set({ pendingApproval: null });
                break;

            // ---------- errors -------------------------------------------
            case 'error':
                set({ errorMessage: msg.error, agentState: 'error' });
                break;

            // ---------- connection / models -------------------------------
            case 'connectionStatus':
                set({
                    isConnected: msg.connected,
                    errorMessage: msg.error ?? null,
                });
                break;

            case 'modelList':
                set({ models: msg.models });
                break;

            // ---------- full state sync ----------------------------------
            case 'syncState':
                set({
                    messages: msg.state.messages,
                    agentState: msg.state.agentState,
                    settings: msg.state.settings,
                    isConnected: msg.state.isConnected,
                    activeModel: msg.state.activeModel,
                    conversations: msg.state.conversations,
                });
                break;

            // ---------- single message push ------------------------------
            case 'messageAdded':
                set((s) => ({ messages: [...s.messages, msg.message] }));
                break;

            // ---------- token usage --------------------------------------
            case 'tokenUsage':
                set({ tokenUsage: msg.usage });
                break;

            default:
                // Unknown message type – ignore silently.
                break;
        }
    },
}));
