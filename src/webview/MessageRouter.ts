import * as vscode from 'vscode';
import type {
    WebviewToExtensionMessage,
    ExtensionToWebviewMessage,
    DisplayMessage,
} from '../types/messages.js';
import { StateManager } from '../state/StateManager.js';

/**
 * Routes messages between the webview and the extension host.
 * Listens for WebviewToExtensionMessage from the webview, handles each type,
 * and sends ExtensionToWebviewMessage back.
 */
export class MessageRouter implements vscode.Disposable {
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly _webview: vscode.Webview;

    // Events for consumers (e.g., AgentLoop integration)
    private readonly _onUserMessage = new vscode.EventEmitter<string>();
    public readonly onUserMessage: vscode.Event<string> = this._onUserMessage.event;

    private readonly _onCancelRequested = new vscode.EventEmitter<void>();
    public readonly onCancelRequested: vscode.Event<void> = this._onCancelRequested.event;

    constructor(webview: vscode.Webview) {
        this._webview = webview;

        // Listen for messages from the webview
        this._disposables.push(
            webview.onDidReceiveMessage((msg: WebviewToExtensionMessage) => {
                void this._handleMessage(msg);
            })
        );
    }

    /**
     * Send a typed message to the webview.
     */
    postMessage(message: ExtensionToWebviewMessage): void {
        void this._webview.postMessage(message);
    }

    /**
     * Dispose all listeners.
     */
    dispose(): void {
        this._onUserMessage.dispose();
        this._onCancelRequested.dispose();
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables.length = 0;
    }

    // ============================================
    // Message Handlers
    // ============================================

    private async _handleMessage(message: WebviewToExtensionMessage): Promise<void> {
        const stateManager = StateManager.instance;

        switch (message.type) {
            case 'sendMessage':
                await this._handleSendMessage(message.text, message.attachments);
                break;

            case 'cancelTask':
                this._handleCancelTask();
                break;

            case 'approveAction':
                this._handleApproval(message.approvalId, true);
                break;

            case 'rejectAction':
                this._handleApproval(message.approvalId, false);
                break;

            case 'updateSettings':
                stateManager.updateSettings(message.settings);
                break;

            case 'testConnection':
                await this._handleTestConnection();
                break;

            case 'listModels':
                await this._handleListModels();
                break;

            case 'loadConversation':
                this._handleLoadConversation(message.conversationId);
                break;

            case 'deleteConversation':
                this._handleDeleteConversation(message.conversationId);
                break;

            case 'newConversation':
                this._handleNewConversation();
                break;

            case 'getState':
                this._handleGetState();
                break;
        }
    }

    // ============================================
    // Individual Handlers
    // ============================================

    /**
     * Handle user sending a chat message.
     * Adds the user message to state and fires the event for AgentLoop.
     */
    private async _handleSendMessage(
        text: string,
        attachments?: Array<{ name: string; mimeType: string; data: string }>,
    ): Promise<void> {
        const stateManager = StateManager.instance;

        // Build content with attachment info
        let content = text;
        if (attachments && attachments.length > 0) {
            const attachmentInfo = attachments.map((a) => {
                if (a.mimeType.startsWith('image/')) {
                    return `[添付画像: ${a.name}]`;
                }
                // For text files, decode and include content
                try {
                    const decoded = Buffer.from(a.data, 'base64').toString('utf-8');
                    return `[添付ファイル: ${a.name}]\n\`\`\`\n${decoded}\n\`\`\``;
                } catch {
                    return `[添付ファイル: ${a.name}]`;
                }
            });
            content = content + '\n\n' + attachmentInfo.join('\n\n');
        }

        // Add user message to display state
        const userMessage: DisplayMessage = {
            id: _generateId(),
            role: 'user',
            content: text + (attachments?.length ? ` (📎 ${attachments.length} file${attachments.length > 1 ? 's' : ''})` : ''),
            timestamp: Date.now(),
        };
        stateManager.addMessage(userMessage);

        // Fire the event so the AgentLoop picks it up
        this._onUserMessage.fire(content);
    }

    /**
     * Handle cancel task request.
     */
    private _handleCancelTask(): void {
        const stateManager = StateManager.instance;
        this._onCancelRequested.fire();
        stateManager.setAgentState('idle');
    }

    /**
     * Handle approval/rejection of a pending action.
     */
    private _handleApproval(approvalId: string, approved: boolean): void {
        const stateManager = StateManager.instance;
        stateManager.resolveApproval(approvalId, approved);
        this.postMessage({ type: 'approvalDismissed' });
    }

    /**
     * Handle connection test request.
     * Stub: attempts a simple fetch to the configured baseUrl.
     */
    private async _handleTestConnection(): Promise<void> {
        const stateManager = StateManager.instance;
        const { baseUrl } = stateManager.settings.provider;

        try {
            // Attempt to reach the server's model list endpoint (OpenAI compatible)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${baseUrl}/v1/models`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (response.ok) {
                stateManager.setConnected(true);
                this.postMessage({ type: 'connectionStatus', connected: true });
                // 接続成功時、自動的にモデル一覧を取得して送信する
                await this._handleListModels();
            } else {
                stateManager.setConnected(false);
                this.postMessage({
                    type: 'connectionStatus',
                    connected: false,
                    error: `Server returned status ${response.status}`,
                });
            }
        } catch (err: unknown) {
            stateManager.setConnected(false);
            const errorMessage =
                err instanceof Error ? err.message : 'Unknown error connecting to server';
            this.postMessage({
                type: 'connectionStatus',
                connected: false,
                error: errorMessage,
            });
        }
    }

    /**
     * Handle model listing request.
     * Stub: fetches models from the OpenAI-compatible endpoint.
     */
    private async _handleListModels(): Promise<void> {
        const stateManager = StateManager.instance;
        const { baseUrl } = stateManager.settings.provider;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${baseUrl}/v1/models`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                this.postMessage({
                    type: 'error',
                    error: `Failed to list models: HTTP ${response.status}`,
                });
                return;
            }

            const data = (await response.json()) as { data?: { id: string; name?: string }[] };
            const models = (data.data ?? []).map((m) => ({
                id: m.id,
                name: m.name ?? m.id,
            }));

            this.postMessage({ type: 'modelList', models });
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : 'Unknown error fetching models';
            this.postMessage({ type: 'error', error: `Failed to list models: ${errorMessage}` });
        }
    }

    /**
     * Handle loading an existing conversation.
     */
    private _handleLoadConversation(conversationId: string): void {
        const stateManager = StateManager.instance;
        const conversation = stateManager.loadConversation(conversationId);
        if (!conversation) {
            this.postMessage({
                type: 'error',
                error: `Conversation not found: ${conversationId}`,
            });
        }
        // State change event will sync the full state automatically
    }

    /**
     * Handle deleting a conversation.
     */
    private _handleDeleteConversation(conversationId: string): void {
        const stateManager = StateManager.instance;
        stateManager.deleteConversation(conversationId);
        // State change event will sync the full state automatically
    }

    /**
     * Handle creating a new conversation.
     */
    private _handleNewConversation(): void {
        const stateManager = StateManager.instance;
        stateManager.setAgentState('idle');
        stateManager.createConversation();
        // State change event will sync the full state automatically
    }

    /**
     * Handle full state sync request from webview.
     */
    private _handleGetState(): void {
        const stateManager = StateManager.instance;
        this.postMessage({
            type: 'syncState',
            state: stateManager.getSyncableState(),
        });
    }
}

// ============================================
// Utilities
// ============================================

function _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
