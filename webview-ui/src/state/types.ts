/**
 * Webview-side type definitions.
 *
 * These mirror the canonical types in src/types/messages.ts so that the
 * webview bundle (built by Vite for the browser) does not need to import
 * from the extension host source tree (built by esbuild for Node.js).
 *
 * Keep these in sync manually whenever the protocol changes.
 */

// ============================================
// Agent state
// ============================================

export type AgentState = 'idle' | 'thinking' | 'executing_tools' | 'waiting_approval' | 'error';

// ============================================
// Display models
// ============================================

export interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: ToolCallDisplay[];
    timestamp: number;
    streaming?: boolean;
}

export interface ToolCallDisplay {
    id: string;
    name: string;
    arguments: string;
    result?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
}

// ============================================
// Approval
// ============================================

export interface ApprovalRequest {
    id: string;
    type: 'file_edit' | 'file_write' | 'command_execution' | 'file_delete';
    description: string;
    details: {
        path?: string;
        diff?: string;
        command?: string;
        cwd?: string;
    };
}

// ============================================
// Tool call info (used during streaming)
// ============================================

export interface ToolCallInfo {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

// ============================================
// Model list
// ============================================

export interface ModelListItem {
    id: string;
    name: string;
    contextWindow?: number;
}

// ============================================
// Conversation
// ============================================

export interface ConversationSummary {
    id: string;
    title: string;
    lastMessage: string;
    timestamp: number;
    messageCount: number;
}

// ============================================
// Settings
// ============================================

export type BackendType = 'ollama' | 'lmstudio' | 'llamacpp' | 'vllm' | 'generic';

export interface ExtensionSettings {
    provider: {
        id: string;
        backendType: BackendType;
        baseUrl: string;
        apiKey: string;
        modelId: string;
    };
    agent: {
        maxIterations: number;
        maxOutputTokens: number;
        contextSafetyRatio: number;
        temperature: number;
        preferNativeToolCalling: boolean;
    };
    approval: {
        autoApproveReads: boolean;
        autoApproveWrites: boolean;
        autoApproveCommands: boolean;
        allowedCommands: string[];
        blockedCommands: string[];
    };
    ui: {
        showTokenCount: boolean;
        showToolCalls: boolean;
        theme: 'auto' | 'dark' | 'light';
    };
}

export function getDefaultSettings(): ExtensionSettings {
    return {
        provider: {
            id: 'default',
            backendType: 'ollama',
            baseUrl: 'http://localhost:11434',
            apiKey: '',
            modelId: '',
        },
        agent: {
            maxIterations: 25,
            maxOutputTokens: 4096,
            contextSafetyRatio: 0.8,
            temperature: 0.0,
            preferNativeToolCalling: true,
        },
        approval: {
            autoApproveReads: true,
            autoApproveWrites: false,
            autoApproveCommands: false,
            allowedCommands: [],
            blockedCommands: ['rm -rf', 'format', 'mkfs', 'dd if='],
        },
        ui: {
            showTokenCount: true,
            showToolCalls: true,
            theme: 'auto',
        },
    };
}

// ============================================
// Syncable state (full state snapshot)
// ============================================

export interface SyncableState {
    messages: DisplayMessage[];
    agentState: AgentState;
    settings: ExtensionSettings;
    isConnected: boolean;
    activeModel: string | null;
    conversations: ConversationSummary[];
}

// ============================================
// Message protocol: Webview -> Extension Host
// ============================================

export type WebviewToExtensionMessage =
    | { type: 'sendMessage'; text: string }
    | { type: 'cancelTask' }
    | { type: 'approveAction'; approvalId: string }
    | { type: 'rejectAction'; approvalId: string }
    | { type: 'updateSettings'; settings: Partial<ExtensionSettings> }
    | { type: 'testConnection' }
    | { type: 'listModels' }
    | { type: 'loadConversation'; conversationId: string }
    | { type: 'deleteConversation'; conversationId: string }
    | { type: 'newConversation' }
    | { type: 'getState' };

// ============================================
// Message protocol: Extension Host -> Webview
// ============================================

export type ExtensionToWebviewMessage =
    | { type: 'streamChunk'; content: string }
    | { type: 'streamEnd' }
    | { type: 'stateChange'; state: AgentState }
    | { type: 'toolCallStarted'; toolCall: ToolCallInfo }
    | { type: 'toolCallCompleted'; toolCallId: string; result: string; success: boolean }
    | { type: 'approvalRequired'; approval: ApprovalRequest }
    | { type: 'approvalDismissed' }
    | { type: 'error'; error: string }
    | { type: 'connectionStatus'; connected: boolean; error?: string }
    | { type: 'modelList'; models: ModelListItem[] }
    | { type: 'syncState'; state: SyncableState }
    | { type: 'messageAdded'; message: DisplayMessage }
    | { type: 'tokenUsage'; usage: TokenUsageInfo };

// ============================================
// Token usage
// ============================================

export interface TokenUsageInfo {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    contextBudget: number;
    contextUsedPercent: number;
}

// ============================================
// Pending approval (UI-side representation)
// ============================================

export interface PendingApproval extends ApprovalRequest {
    // Extends ApprovalRequest as-is; kept as a separate interface
    // so the UI can add transient fields in the future.
}
