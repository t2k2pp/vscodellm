import * as vscode from 'vscode';
import { StateManager } from './state/StateManager.js';
import { WebviewProvider } from './webview/WebviewProvider.js';
import { ProviderRegistry } from './core/llm/ProviderRegistry.js';
import { AgentLoop } from './core/agent/AgentLoop.js';
import { TaskState } from './core/agent/types.js';
import { ToolRegistry } from './core/tools/ToolRegistry.js';
import { ToolExecutor } from './core/tools/ToolExecutor.js';
import { ToolValidator } from './core/tools/ToolValidator.js';
import { ContextManager } from './core/context/ContextManager.js';
import { ConversationHistory } from './core/context/ConversationHistory.js';
import { SystemPrompt } from './core/prompts/SystemPrompt.js';
import { PathValidator } from './security/PathValidator.js';
import { CommandSanitizer } from './security/CommandSanitizer.js';
import { ApprovalService } from './security/ApprovalService.js';
import { WorkspaceService } from './services/workspace/WorkspaceService.js';
import { TerminalService } from './services/terminal/TerminalService.js';
import { IgnoreService } from './services/ignore/IgnoreService.js';
import { ReadFileTool } from './core/tools/handlers/ReadFileTool.js';
import { WriteFileTool } from './core/tools/handlers/WriteFileTool.js';
import { EditFileTool } from './core/tools/handlers/EditFileTool.js';
import { ExecuteCommandTool } from './core/tools/handlers/ExecuteCommandTool.js';
import { SearchFilesTool } from './core/tools/handlers/SearchFilesTool.js';
import { ListFilesTool } from './core/tools/handlers/ListFilesTool.js';
import { AskUserTool } from './core/tools/handlers/AskUserTool.js';
import { TaskCompleteTool } from './core/tools/handlers/TaskCompleteTool.js';
import { setOutputChannel } from './utils/logger.js';
import type { DisplayMessage, AgentState } from './types/messages.js';

// Current agent loop instance (one at a time)
let activeAgentLoop: AgentLoop | null = null;

/**
 * Called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext): void {
    // ============================================
    // 0. Logger setup
    // ============================================
    const outputChannel = vscode.window.createOutputChannel('Local LLM Agent');
    setOutputChannel(outputChannel);
    context.subscriptions.push(outputChannel);

    // ============================================
    // 1. Initialize StateManager (singleton)
    // ============================================
    const stateManager = StateManager.initialize(context);
    context.subscriptions.push({ dispose: () => stateManager.dispose() });

    // ============================================
    // 2. Workspace root
    // ============================================
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    // ============================================
    // 3. Create and register WebviewProvider
    // ============================================
    const webviewProvider = new WebviewProvider(context);

    const webviewRegistration = vscode.window.registerWebviewViewProvider(
        WebviewProvider.viewType,
        webviewProvider,
        { webviewOptions: { retainContextWhenHidden: true } },
    );
    context.subscriptions.push(webviewRegistration);

    // ============================================
    // 4. Initialize services
    // ============================================
    const workspaceService = new WorkspaceService(workspaceRoot);
    const terminalService = new TerminalService(workspaceRoot);
    context.subscriptions.push(terminalService);

    const ignoreService = new IgnoreService(workspaceRoot);
    void ignoreService.initialize();

    const pathValidator = new PathValidator(workspaceRoot);
    const commandSanitizer = new CommandSanitizer(stateManager.settings);
    const approvalService = new ApprovalService(stateManager.settings, stateManager, webviewProvider);

    // ============================================
    // 5. Register tools
    // ============================================
    const toolRegistry = new ToolRegistry();
    toolRegistry.register(new ReadFileTool(workspaceService, ignoreService));
    toolRegistry.register(new WriteFileTool(workspaceService, ignoreService, pathValidator));
    toolRegistry.register(new EditFileTool(workspaceService, ignoreService, pathValidator));
    toolRegistry.register(new ExecuteCommandTool(terminalService, commandSanitizer));
    toolRegistry.register(new SearchFilesTool(workspaceService));
    toolRegistry.register(new ListFilesTool(workspaceService, ignoreService));
    toolRegistry.register(new AskUserTool());
    toolRegistry.register(new TaskCompleteTool());

    const toolValidator = new ToolValidator();
    const toolExecutor = new ToolExecutor(toolRegistry, toolValidator);

    // ============================================
    // 6. LLM Provider Registry
    // ============================================
    const providerRegistry = new ProviderRegistry();

    // ============================================
    // 7. Helper: start an agent loop for a message
    // ============================================
    function startAgentLoop(userMessage: string): void {
        // Cancel any running loop
        activeAgentLoop?.cancel();

        const settings = stateManager.settings;

        // Ensure provider is registered
        const providerId = settings.provider.id;
        if (!providerRegistry.get(providerId)) {
            providerRegistry.register({
                id: providerId,
                name: settings.provider.backendType,
                backendType: settings.provider.backendType,
                baseUrl: settings.provider.baseUrl,
                apiKey: settings.provider.apiKey,
            });
        }

        const provider = providerRegistry.get(providerId);
        if (!provider) {
            webviewProvider.postMessage({ type: 'error', error: 'No LLM provider configured.' });
            stateManager.setAgentState('idle');
            return;
        }

        // Build system prompt
        const systemPrompt = new SystemPrompt(toolRegistry);
        const systemPromptText = systemPrompt.build({
            workspaceRoot,
            useXmlTools: !settings.agent.preferNativeToolCalling,
        });

        // Create context manager for this run
        const conversationHistory = new ConversationHistory();
        const contextManager = new ContextManager(provider, {
            modelId: settings.provider.modelId,
            maxOutputTokens: settings.agent.maxOutputTokens,
            contextSafetyRatio: settings.agent.contextSafetyRatio,
            systemPrompt: systemPromptText,
        });

        // Streaming text accumulator for display
        let streamingContent = '';
        let assistantMessageId = '';

        // Create event emitters
        const onStateChange = {
            fire: (e: { state: TaskState }) => {
                const agentStateMap: Record<string, AgentState> = {
                    [TaskState.IDLE]: 'idle',
                    [TaskState.THINKING]: 'thinking',
                    [TaskState.EXECUTING_TOOLS]: 'executing_tools',
                    [TaskState.WAITING_APPROVAL]: 'waiting_approval',
                    [TaskState.COMPLETED]: 'idle',
                    [TaskState.CANCELLED]: 'idle',
                    [TaskState.ERROR]: 'error',
                };
                const state = agentStateMap[e.state] || 'idle';
                stateManager.setAgentState(state);

                if (e.state === TaskState.COMPLETED || e.state === TaskState.CANCELLED) {
                    // Finalize streaming message
                    if (streamingContent && assistantMessageId) {
                        stateManager.updateLastAssistantMessage(streamingContent, false);
                        webviewProvider.postMessage({ type: 'streamEnd' });
                    }
                    activeAgentLoop = null;
                }
            },
        };

        const onStreamChunk = {
            fire: (e: { type: string; content: string }) => {
                if (e.type === 'text') {
                    streamingContent += e.content;
                    webviewProvider.postMessage({ type: 'streamChunk', content: e.content });

                    // Create assistant message on first chunk
                    if (!assistantMessageId) {
                        assistantMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                        const assistantMsg: DisplayMessage = {
                            id: assistantMessageId,
                            role: 'assistant',
                            content: streamingContent,
                            timestamp: Date.now(),
                            streaming: true,
                        };
                        stateManager.addMessage(assistantMsg);
                    } else {
                        stateManager.updateLastAssistantMessage(streamingContent, true);
                    }
                }
            },
        };

        const onToolCall = {
            fire: (e: { id: string; name: string; arguments: string; status: string; result?: string }) => {
                if (e.status === 'started') {
                    webviewProvider.postMessage({
                        type: 'toolCallStarted',
                        toolCall: { id: e.id, name: e.name, arguments: JSON.parse(e.arguments || '{}') },
                    });
                } else {
                    webviewProvider.postMessage({
                        type: 'toolCallCompleted',
                        toolCallId: e.id,
                        result: e.result || '',
                        success: e.status === 'completed',
                    });
                }
            },
        };

        const onError = {
            fire: (e: { error: Error }) => {
                webviewProvider.postMessage({ type: 'error', error: e.error.message });
            },
        };

        // Create and run agent loop
        activeAgentLoop = new AgentLoop({
            provider,
            toolExecutor,
            toolRegistry,
            contextManager,
            conversationHistory,
            approvalService,
            workspaceRoot,
            settings: {
                maxIterations: settings.agent.maxIterations,
                temperature: settings.agent.temperature,
                maxOutputTokens: settings.agent.maxOutputTokens,
                modelId: settings.provider.modelId,
                preferNativeToolCalling: settings.agent.preferNativeToolCalling,
            },
            onStateChange,
            onStreamChunk,
            onToolCall,
            onError,
        });

        void activeAgentLoop.run(userMessage);
    }

    // ============================================
    // 8. Wire WebviewProvider message events to AgentLoop
    // ============================================
    // The WebviewProvider creates MessageRouter internally.
    // We listen for user messages and cancel requests via the provider events
    // by subscribing to MessageRouter events after the webview resolves.
    // For now, we use a simpler approach: override in WebviewProvider.
    // The MessageRouter fires onUserMessage which we subscribe to.

    // We need to hook into the MessageRouter after webview resolves.
    // Add a method to WebviewProvider to expose event subscriptions.

    // Simplified approach: listen on state changes for new user messages.
    stateManager.onDidAddMessage((message) => {
        if (message.role === 'user' && stateManager.agentState === 'idle') {
            // Don't auto-start for messages added by explainSelection/refactorSelection
            // Those messages are handled separately below
        }
    });

    // ============================================
    // 9. Register commands
    // ============================================

    // New Chat
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.newChat', () => {
            activeAgentLoop?.cancel();
            stateManager.setAgentState('idle');
            stateManager.createConversation();
            webviewProvider.reveal();
        }),
    );

    // Cancel Task
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.cancelTask', () => {
            activeAgentLoop?.cancel();
            activeAgentLoop = null;
            stateManager.setAgentState('idle');
        }),
    );

    // Open Settings
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.openSettings', () => {
            void vscode.commands.executeCommand('workbench.action.openSettings', 'localLlmAgent');
        }),
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

            if (!stateManager.activeConversationId) {
                stateManager.createConversation('Explain Code');
            }
            webviewProvider.reveal();
            startAgentLoop(prompt);
        }),
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

            if (!stateManager.activeConversationId) {
                stateManager.createConversation('Refactor Code');
            }
            webviewProvider.reveal();
            startAgentLoop(prompt);
        }),
    );

    // ============================================
    // 10. Expose startAgentLoop to WebviewProvider's MessageRouter
    // ============================================
    // We need the MessageRouter's onUserMessage to trigger startAgentLoop.
    // Since WebviewProvider creates MessageRouter lazily in resolveWebviewView,
    // we use a message-based approach via the provider.
    // Add a simple hook: provider listens and calls back.
    webviewProvider.onUserMessage = (text: string) => {
        if (!stateManager.activeConversationId) {
            stateManager.createConversation();
        }
        startAgentLoop(text);
    };

    webviewProvider.onCancelRequested = () => {
        activeAgentLoop?.cancel();
        activeAgentLoop = null;
        stateManager.setAgentState('idle');
    };

    // ============================================
    // 11. Ready
    // ============================================
    vscode.window.showInformationMessage('Local LLM Agent is now active!');
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
    activeAgentLoop?.cancel();
    activeAgentLoop = null;
}
