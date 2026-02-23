import * as vscode from 'vscode';
import { StateManager } from './state/StateManager.js';
import { WebviewProvider } from './webview/WebviewProvider.js';

/**
 * Called when the extension is activated.
 * Initializes state management, registers the webview provider, and sets up commands.
 */
export function activate(context: vscode.ExtensionContext): void {
    // ============================================
    // 1. Initialize StateManager (singleton)
    // ============================================
    const stateManager = StateManager.initialize(context);
    context.subscriptions.push({ dispose: () => stateManager.dispose() });

    // ============================================
    // 2. Create and register WebviewProvider
    // ============================================
    const webviewProvider = new WebviewProvider(context);

    const webviewRegistration = vscode.window.registerWebviewViewProvider(
        WebviewProvider.viewType,
        webviewProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }
    );
    context.subscriptions.push(webviewRegistration);

    // ============================================
    // 3. Register commands
    // ============================================

    // New Chat
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.newChat', () => {
            stateManager.setAgentState('idle');
            stateManager.createConversation();
            webviewProvider.reveal();
        })
    );

    // Cancel Task
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.cancelTask', () => {
            stateManager.setAgentState('idle');
            webviewProvider.postMessage({ type: 'stateChange', state: 'idle' });
        })
    );

    // Open Settings
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.openSettings', () => {
            void vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'localLlmAgent'
            );
        })
    );

    // Explain Selection
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.explainSelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor with a selection.');
                return;
            }
            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showWarningMessage('No text selected.');
                return;
            }

            const language = editor.document.languageId;
            const prompt = `Explain the following ${language} code:\n\n\`\`\`${language}\n${selection}\n\`\`\``;

            // Ensure a conversation exists and send the prompt
            if (!stateManager.activeConversationId) {
                stateManager.createConversation('Explain Code');
            }
            // Reveal the chat panel and send the message via webview
            webviewProvider.reveal();
            webviewProvider.postMessage({
                type: 'syncState',
                state: stateManager.getSyncableState(),
            });
            // Simulate sending the message by adding it as a user message
            stateManager.addMessage({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                role: 'user',
                content: prompt,
                timestamp: Date.now(),
            });
        })
    );

    // Refactor Selection
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.refactorSelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor with a selection.');
                return;
            }
            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showWarningMessage('No text selected.');
                return;
            }

            const language = editor.document.languageId;
            const prompt = `Refactor the following ${language} code for better readability, performance, and maintainability:\n\n\`\`\`${language}\n${selection}\n\`\`\``;

            // Ensure a conversation exists and send the prompt
            if (!stateManager.activeConversationId) {
                stateManager.createConversation('Refactor Code');
            }
            webviewProvider.reveal();
            webviewProvider.postMessage({
                type: 'syncState',
                state: stateManager.getSyncableState(),
            });
            stateManager.addMessage({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                role: 'user',
                content: prompt,
                timestamp: Date.now(),
            });
        })
    );

    // ============================================
    // 4. Ready
    // ============================================
    vscode.window.showInformationMessage('Local LLM Agent is now active!');
}

/**
 * Called when the extension is deactivated.
 * Cleanup is handled via context.subscriptions.
 */
export function deactivate(): void {
    // Cleanup is handled by disposables pushed to context.subscriptions
}
