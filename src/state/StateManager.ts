import * as vscode from 'vscode';
import type {
    AgentState,
    ConversationSummary,
    DisplayMessage,
    ExtensionSettings,
    SyncableState,
} from '../types/messages.js';
import { getDefaultSettings } from '../types/messages.js';

// ============================================
// Types
// ============================================

interface Conversation {
    id: string;
    title: string;
    messages: DisplayMessage[];
    createdAt: number;
    updatedAt: number;
}

interface PendingApproval {
    resolve: (approved: boolean) => void;
}

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEY_SETTINGS = 'localLlmAgent.settings';
const STORAGE_KEY_CONVERSATIONS = 'localLlmAgent.conversations';
const STORAGE_KEY_ACTIVE_CONVERSATION = 'localLlmAgent.activeConversationId';

// ============================================
// StateManager (Singleton)
// ============================================

export class StateManager {
    private static _instance: StateManager | undefined;

    private readonly _context: vscode.ExtensionContext;
    private _settings: ExtensionSettings;
    private _conversations: Map<string, Conversation> = new Map();
    private _activeConversationId: string | null = null;
    private _agentState: AgentState = 'idle';
    private _isConnected = false;

    // Approval tracking
    private _pendingApprovals: Map<string, PendingApproval> = new Map();

    // Debounced persistence
    private _persistTimer: ReturnType<typeof setTimeout> | undefined;
    private static readonly PERSIST_DEBOUNCE_MS = 1000;

    // Events
    private readonly _onDidChangeState = new vscode.EventEmitter<SyncableState>();
    public readonly onDidChangeState: vscode.Event<SyncableState> = this._onDidChangeState.event;

    private readonly _onDidChangeAgentState = new vscode.EventEmitter<AgentState>();
    public readonly onDidChangeAgentState: vscode.Event<AgentState> = this._onDidChangeAgentState.event;

    private readonly _onDidAddMessage = new vscode.EventEmitter<DisplayMessage>();
    public readonly onDidAddMessage: vscode.Event<DisplayMessage> = this._onDidAddMessage.event;

    // ============================================
    // Lifecycle
    // ============================================

    private constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._settings = getDefaultSettings();
    }

    /**
     * Initialize the singleton. Must be called once during extension activation.
     */
    static initialize(context: vscode.ExtensionContext): StateManager {
        if (StateManager._instance) {
            throw new Error('StateManager is already initialized');
        }
        const instance = new StateManager(context);
        instance._loadFromStorage();
        StateManager._instance = instance;
        return instance;
    }

    /**
     * Get the singleton instance.
     */
    static get instance(): StateManager {
        if (!StateManager._instance) {
            throw new Error('StateManager has not been initialized. Call initialize() first.');
        }
        return StateManager._instance;
    }

    /**
     * Dispose the singleton (for testing or deactivation).
     */
    dispose(): void {
        if (this._persistTimer) {
            clearTimeout(this._persistTimer);
            this._persistTimer = undefined;
        }
        // Force a final persist
        this._persistNow();
        // Reject any pending approvals
        for (const [, pending] of this._pendingApprovals) {
            pending.resolve(false);
        }
        this._pendingApprovals.clear();
        this._onDidChangeState.dispose();
        this._onDidChangeAgentState.dispose();
        this._onDidAddMessage.dispose();
        StateManager._instance = undefined;
    }

    // ============================================
    // Settings
    // ============================================

    get settings(): ExtensionSettings {
        return this._settings;
    }

    updateSettings(partial: Partial<ExtensionSettings>): void {
        this._settings = this._mergeSettings(this._settings, partial);
        this._schedulePersist();
        this._fireStateChange();
    }

    private _mergeSettings(
        current: ExtensionSettings,
        partial: Partial<ExtensionSettings>
    ): ExtensionSettings {
        return {
            provider: { ...current.provider, ...(partial.provider ?? {}) },
            agent: { ...current.agent, ...(partial.agent ?? {}) },
            approval: { ...current.approval, ...(partial.approval ?? {}) },
            ui: { ...current.ui, ...(partial.ui ?? {}) },
        };
    }

    // ============================================
    // Agent State
    // ============================================

    get agentState(): AgentState {
        return this._agentState;
    }

    setAgentState(state: AgentState): void {
        if (this._agentState === state) {
            return;
        }
        this._agentState = state;
        this._onDidChangeAgentState.fire(state);
        this._fireStateChange();
    }

    // ============================================
    // Connection Status
    // ============================================

    get isConnected(): boolean {
        return this._isConnected;
    }

    setConnected(connected: boolean): void {
        this._isConnected = connected;
        this._fireStateChange();
    }

    // ============================================
    // Conversations
    // ============================================

    get activeConversationId(): string | null {
        return this._activeConversationId;
    }

    get activeConversation(): Conversation | undefined {
        if (!this._activeConversationId) {
            return undefined;
        }
        return this._conversations.get(this._activeConversationId);
    }

    /**
     * Create a new conversation and set it as active.
     */
    createConversation(title?: string): Conversation {
        const id = this._generateId();
        const now = Date.now();
        const conversation: Conversation = {
            id,
            title: title ?? 'New Chat',
            messages: [],
            createdAt: now,
            updatedAt: now,
        };
        this._conversations.set(id, conversation);
        this._activeConversationId = id;
        this._schedulePersist();
        this._fireStateChange();
        return conversation;
    }

    /**
     * Load an existing conversation by ID.
     */
    loadConversation(conversationId: string): Conversation | undefined {
        const conversation = this._conversations.get(conversationId);
        if (conversation) {
            this._activeConversationId = conversationId;
            this._schedulePersist();
            this._fireStateChange();
        }
        return conversation;
    }

    /**
     * Delete a conversation.
     */
    deleteConversation(conversationId: string): boolean {
        const deleted = this._conversations.delete(conversationId);
        if (deleted) {
            if (this._activeConversationId === conversationId) {
                this._activeConversationId = null;
            }
            this._schedulePersist();
            this._fireStateChange();
        }
        return deleted;
    }

    /**
     * List all conversations as summaries (sorted by most recent first).
     */
    listConversations(): ConversationSummary[] {
        const summaries: ConversationSummary[] = [];
        for (const [, conv] of this._conversations) {
            const lastMsg = conv.messages[conv.messages.length - 1];
            summaries.push({
                id: conv.id,
                title: conv.title,
                lastMessage: lastMsg?.content.slice(0, 100) ?? '',
                timestamp: conv.updatedAt,
                messageCount: conv.messages.length,
            });
        }
        summaries.sort((a, b) => b.timestamp - a.timestamp);
        return summaries;
    }

    // ============================================
    // Messages
    // ============================================

    /**
     * Get messages for the active conversation.
     */
    getMessages(): DisplayMessage[] {
        return this.activeConversation?.messages ?? [];
    }

    /**
     * Add a message to the active conversation.
     * Creates a new conversation if none is active.
     */
    addMessage(message: DisplayMessage): void {
        if (!this._activeConversationId) {
            this.createConversation();
        }
        const conversation = this._conversations.get(this._activeConversationId!);
        if (!conversation) {
            return;
        }
        conversation.messages.push(message);
        conversation.updatedAt = Date.now();

        // Update title from first user message if still default
        if (
            conversation.title === 'New Chat' &&
            message.role === 'user' &&
            conversation.messages.filter((m) => m.role === 'user').length === 1
        ) {
            conversation.title = message.content.slice(0, 60);
        }

        this._schedulePersist();
        this._onDidAddMessage.fire(message);
    }

    /**
     * Update the last assistant message (for streaming).
     */
    updateLastAssistantMessage(content: string, streaming: boolean): void {
        const conversation = this.activeConversation;
        if (!conversation) {
            return;
        }
        const lastMsg = [...conversation.messages].reverse().find((m) => m.role === 'assistant');
        if (lastMsg) {
            lastMsg.content = content;
            lastMsg.streaming = streaming;
            conversation.updatedAt = Date.now();
        }
    }

    // ============================================
    // Approval
    // ============================================

    /**
     * Request approval from the user. Returns a Promise<boolean> that resolves
     * when the user approves or rejects the action.
     */
    requestApproval(approvalId: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._pendingApprovals.set(approvalId, { resolve });
        });
    }

    /**
     * Resolve a pending approval.
     */
    resolveApproval(approvalId: string, approved: boolean): void {
        const pending = this._pendingApprovals.get(approvalId);
        if (pending) {
            pending.resolve(approved);
            this._pendingApprovals.delete(approvalId);
        }
    }

    /**
     * Check if there is a pending approval.
     */
    hasPendingApproval(approvalId: string): boolean {
        return this._pendingApprovals.has(approvalId);
    }

    // ============================================
    // Syncable State (for webview)
    // ============================================

    /**
     * Generate the complete state snapshot for the webview.
     */
    getSyncableState(): SyncableState {
        return {
            messages: this.getMessages(),
            agentState: this._agentState,
            settings: this._settings,
            isConnected: this._isConnected,
            activeModel: this._settings.provider.modelId || null,
            conversations: this.listConversations(),
        };
    }

    // ============================================
    // Storage (Persistence)
    // ============================================

    private _loadFromStorage(): void {
        const storedSettings = this._context.globalState.get<ExtensionSettings>(STORAGE_KEY_SETTINGS);
        if (storedSettings) {
            this._settings = this._mergeSettings(getDefaultSettings(), storedSettings);
        }

        const storedConversations =
            this._context.globalState.get<[string, Conversation][]>(STORAGE_KEY_CONVERSATIONS);
        if (storedConversations) {
            this._conversations = new Map(storedConversations);
        }

        const storedActiveId = this._context.globalState.get<string>(STORAGE_KEY_ACTIVE_CONVERSATION);
        if (storedActiveId && this._conversations.has(storedActiveId)) {
            this._activeConversationId = storedActiveId;
        }
    }

    private _schedulePersist(): void {
        if (this._persistTimer) {
            clearTimeout(this._persistTimer);
        }
        this._persistTimer = setTimeout(() => {
            this._persistNow();
        }, StateManager.PERSIST_DEBOUNCE_MS);
    }

    private _persistNow(): void {
        void this._context.globalState.update(STORAGE_KEY_SETTINGS, this._settings);
        void this._context.globalState.update(
            STORAGE_KEY_CONVERSATIONS,
            Array.from(this._conversations.entries())
        );
        void this._context.globalState.update(
            STORAGE_KEY_ACTIVE_CONVERSATION,
            this._activeConversationId
        );
    }

    // ============================================
    // Internal
    // ============================================

    private _fireStateChange(): void {
        this._onDidChangeState.fire(this.getSyncableState());
    }

    private _generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
}
