---

# Local LLM Agent -- VS Code Extension Architecture Document

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Core Modules](#2-core-modules)
3. [LLM Provider Abstraction](#3-llm-provider-abstraction)
4. [Agentic Loop Design](#4-agentic-loop-design)
5. [Tool System](#5-tool-system)
6. [Diff/Patch System](#6-diffpatch-system)
7. [Context Management](#7-context-management)
8. [Webview Chat UI Architecture](#8-webview-chat-ui-architecture)
9. [Message Protocol](#9-message-protocol)
10. [State Management](#10-state-management)
11. [Security](#11-security)
12. [Extension Manifest](#12-extension-manifest)
13. [Build and Development Setup](#13-build-and-development-setup)
14. [Phase-by-Phase Implementation Roadmap](#14-phase-by-phase-implementation-roadmap)

---

## 1. Project Structure

```
local-llm-agent/
├── .vscode/
│   ├── launch.json                    # Extension debug configurations
│   ├── tasks.json                     # Build tasks
│   └── settings.json                  # Workspace settings
├── src/
│   ├── extension.ts                   # VS Code extension entry point
│   ├── core/
│   │   ├── agent/
│   │   │   ├── AgentLoop.ts           # Main agentic execution cycle
│   │   │   ├── AgentLoop.test.ts
│   │   │   ├── TaskState.ts           # Task state machine
│   │   │   ├── StreamProcessor.ts     # SSE stream response handler
│   │   │   └── types.ts               # Agent-specific types
│   │   ├── llm/
│   │   │   ├── LlmProvider.ts         # Abstract LLM provider interface
│   │   │   ├── OpenAiCompatibleProvider.ts  # OpenAI-compatible implementation
│   │   │   ├── ProviderRegistry.ts    # Provider discovery and management
│   │   │   ├── ModelInfo.ts           # Model metadata and capabilities
│   │   │   ├── TokenCounter.ts        # Token counting abstraction
│   │   │   ├── backends/
│   │   │   │   ├── OllamaBackend.ts       # Ollama-specific adaptations
│   │   │   │   ├── LmStudioBackend.ts     # LM Studio-specific adaptations
│   │   │   │   ├── LlamaCppBackend.ts     # llama.cpp-specific adaptations
│   │   │   │   ├── VllmBackend.ts         # vLLM-specific adaptations
│   │   │   │   └── GenericBackend.ts      # Generic OpenAI-compatible fallback
│   │   │   └── types.ts              # LLM types (messages, completions, etc.)
│   │   ├── tools/
│   │   │   ├── ToolRegistry.ts        # Tool registration and lookup
│   │   │   ├── ToolExecutor.ts        # Tool dispatch and execution
│   │   │   ├── ToolValidator.ts       # Input/output validation
│   │   │   ├── definitions.ts         # Tool schemas (for function calling)
│   │   │   ├── handlers/
│   │   │   │   ├── ReadFileTool.ts
│   │   │   │   ├── WriteFileTool.ts
│   │   │   │   ├── EditFileTool.ts
│   │   │   │   ├── ExecuteCommandTool.ts
│   │   │   │   ├── SearchFilesTool.ts
│   │   │   │   ├── ListFilesTool.ts
│   │   │   │   ├── RunTestsTool.ts
│   │   │   │   ├── AskUserTool.ts
│   │   │   │   └── TaskCompleteTool.ts
│   │   │   └── types.ts              # Tool interfaces
│   │   ├── diff/
│   │   │   ├── DiffGenerator.ts       # Generate diffs from LLM output
│   │   │   ├── DiffApplier.ts         # Apply diffs to files
│   │   │   ├── DiffPreview.ts         # VS Code diff preview integration
│   │   │   ├── SearchReplace.ts       # Search/replace block parser
│   │   │   └── types.ts
│   │   ├── context/
│   │   │   ├── ContextManager.ts      # Conversation context budget
│   │   │   ├── ContextCompactor.ts    # Auto-compaction logic
│   │   │   ├── FileContextProvider.ts # Workspace file context gathering
│   │   │   ├── ConversationHistory.ts # Message history management
│   │   │   └── types.ts
│   │   └── prompts/
│   │       ├── SystemPrompt.ts        # System prompt builder
│   │       ├── ToolPrompts.ts         # Tool description prompts (XML fallback)
│   │       └── templates/
│   │           ├── system.md          # Main system prompt template
│   │           ├── tool-descriptions.md
│   │           └── compaction.md      # Compaction summary prompt
│   ├── services/
│   │   ├── workspace/
│   │   │   ├── WorkspaceService.ts    # Workspace file operations
│   │   │   ├── FileWatcher.ts         # File change monitoring
│   │   │   └── GlobSearch.ts          # Glob-based file search
│   │   ├── terminal/
│   │   │   ├── TerminalService.ts     # Terminal creation and command exec
│   │   │   └── ShellIntegration.ts    # Shell output capture
│   │   ├── editor/
│   │   │   ├── EditorService.ts       # Open files, apply edits
│   │   │   └── DocumentTracker.ts     # Track open documents
│   │   └── ignore/
│   │       ├── IgnoreService.ts       # .localllmignore file processing
│   │       └── patterns.ts            # Default ignore patterns
│   ├── webview/
│   │   ├── WebviewProvider.ts         # WebviewViewProvider implementation
│   │   ├── MessageRouter.ts           # Route messages between host/webview
│   │   └── WebviewStateSync.ts        # Sync state to webview
│   ├── state/
│   │   ├── StateManager.ts           # Global state singleton
│   │   ├── SettingsManager.ts        # Extension settings
│   │   ├── ConversationStore.ts      # Conversation persistence
│   │   └── types.ts
│   ├── security/
│   │   ├── ApprovalService.ts        # User approval flow
│   │   ├── PathValidator.ts          # File path access control
│   │   └── CommandSanitizer.ts       # Command sanitization
│   ├── utils/
│   │   ├── logger.ts                 # Structured logging
│   │   ├── disposable.ts             # Disposable management helpers
│   │   ├── async.ts                  # Async utilities (retry, debounce)
│   │   ├── platform.ts              # Cross-platform path helpers
│   │   └── errors.ts                # Custom error types
│   └── types/
│       ├── index.ts                  # Re-exports
│       ├── messages.ts               # All message type definitions
│       ├── settings.ts               # Settings type definitions
│       └── vscode.d.ts              # Additional VS Code type augmentations
├── webview-ui/
│   ├── index.html                    # Webview HTML shell
│   ├── src/
│   │   ├── main.tsx                  # React entry point
│   │   ├── App.tsx                   # Root component
│   │   ├── vscode.ts                 # VS Code API bridge (acquireVsCodeApi)
│   │   ├── hooks/
│   │   │   ├── useExtensionState.ts  # State sync with extension host
│   │   │   ├── useMessages.ts        # Message send/receive hook
│   │   │   └── useSettings.ts        # Settings access hook
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatView.tsx          # Main chat container
│   │   │   │   ├── MessageList.tsx       # Scrollable message list
│   │   │   │   ├── MessageBubble.tsx     # Individual message display
│   │   │   │   ├── InputArea.tsx         # Message input with send button
│   │   │   │   ├── StreamingMessage.tsx  # Streaming text display
│   │   │   │   └── ToolCallDisplay.tsx   # Tool call visualization
│   │   │   ├── diff/
│   │   │   │   ├── DiffView.tsx          # Inline diff display
│   │   │   │   └── DiffActions.tsx       # Accept/reject diff buttons
│   │   │   ├── settings/
│   │   │   │   ├── SettingsView.tsx      # Settings panel
│   │   │   │   ├── ProviderConfig.tsx    # LLM provider configuration
│   │   │   │   └── ModelSelector.tsx     # Model picker
│   │   │   ├── history/
│   │   │   │   ├── HistoryView.tsx       # Conversation history list
│   │   │   │   └── HistoryItem.tsx       # Single history entry
│   │   │   ├── approval/
│   │   │   │   └── ApprovalDialog.tsx    # Tool execution approval UI
│   │   │   └── common/
│   │   │       ├── CodeBlock.tsx         # Syntax-highlighted code
│   │   │       ├── Markdown.tsx          # Markdown renderer
│   │   │       ├── Spinner.tsx           # Loading indicator
│   │   │       └── Icon.tsx             # VS Code codicon wrapper
│   │   ├── state/
│   │   │   ├── store.ts              # Lightweight state store (zustand)
│   │   │   └── types.ts
│   │   └── styles/
│   │       ├── global.css            # Global styles using VS Code CSS vars
│   │       ├── chat.css
│   │       └── diff.css
│   ├── tsconfig.json
│   └── vite.config.ts               # Vite config for webview build
├── test/
│   ├── setup.ts                      # Vitest setup
│   ├── mocks/
│   │   ├── vscode.ts                 # VS Code API mock
│   │   └── llm.ts                    # LLM API mock
│   ├── unit/                         # Unit tests (mirrors src/)
│   └── integration/                  # Integration tests
├── resources/
│   ├── icon.png                      # Extension icon
│   └── walkthrough/                  # Getting started content
├── package.json                      # Extension manifest
├── tsconfig.json                     # Root TypeScript config
├── esbuild.mjs                       # esbuild config for extension host
├── vitest.config.ts                  # Vitest configuration
├── .vscodeignore                     # Files to exclude from VSIX
├── .eslintrc.json                    # ESLint configuration
├── .prettierrc                       # Prettier configuration
├── CHANGELOG.md
├── README.md
└── LICENSE
```

**Key architectural decisions reflected in this structure:**

- **Two separate build targets**: The `src/` directory is bundled with esbuild into a single Node.js bundle for the extension host. The `webview-ui/` directory is built with Vite into a separate browser bundle. These two codebases share only type definitions (from `src/types/`).
- **Clear module boundaries**: `core/` contains pure business logic that is testable without VS Code. `services/` wraps VS Code APIs. `webview/` handles the webview lifecycle on the host side.
- **Co-located tests**: Unit tests sit next to source files (e.g., `AgentLoop.test.ts`). Integration tests live in `test/integration/`.

---

## 2. Core Modules

### 2.1 Module Dependency Graph

```
extension.ts
    ├── WebviewProvider (webview/)
    │   └── MessageRouter
    ├── StateManager (state/)
    │   ├── SettingsManager
    │   └── ConversationStore
    └── AgentLoop (core/agent/)
        ├── LlmProvider (core/llm/)
        │   ├── OpenAiCompatibleProvider
        │   ├── Backend (backends/*)
        │   └── TokenCounter
        ├── ToolExecutor (core/tools/)
        │   ├── ToolRegistry
        │   ├── ToolValidator
        │   └── Handlers (handlers/*)
        │       ├── WorkspaceService (services/workspace/)
        │       ├── TerminalService (services/terminal/)
        │       ├── EditorService (services/editor/)
        │       └── IgnoreService (services/ignore/)
        ├── ContextManager (core/context/)
        │   ├── ContextCompactor
        │   ├── FileContextProvider
        │   └── ConversationHistory
        ├── DiffApplier (core/diff/)
        ├── SystemPrompt (core/prompts/)
        └── ApprovalService (security/)
```

### 2.2 Module Responsibilities

**`extension.ts`** -- Extension entry point. Registers the WebviewViewProvider, initializes the StateManager, sets up command handlers, and wires the dependency graph.

```typescript
// src/extension.ts -- activation signature
export function activate(context: vscode.ExtensionContext): void {
    const stateManager = StateManager.initialize(context);
    const settingsManager = new SettingsManager(context);
    const webviewProvider = new WebviewProvider(context, stateManager);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'localLlmAgent.chatView',
            webviewProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('localLlmAgent.newChat', () => {
            webviewProvider.startNewConversation();
        }),
        vscode.commands.registerCommand('localLlmAgent.cancelTask', () => {
            webviewProvider.cancelCurrentTask();
        })
    );
}
```

**`core/agent/AgentLoop.ts`** -- The brain of the extension. Manages the autonomous cycle of: send messages to LLM, parse response, execute tools, loop until complete. Detailed in Section 4.

**`core/llm/LlmProvider.ts`** -- Abstract interface for LLM communication. Handles streaming completions, model listing, and capability detection. Detailed in Section 3.

**`core/tools/ToolRegistry.ts`** -- Registers all available tools, provides their schemas for function calling, and dispatches execution to the correct handler.

**`core/context/ContextManager.ts`** -- Tracks token budget, manages conversation history truncation and compaction. Detailed in Section 7.

**`services/workspace/WorkspaceService.ts`** -- Wraps `vscode.workspace.fs` for cross-platform file read/write/search operations. Provides an abstraction layer so `core/` never imports `vscode` directly.

**`services/terminal/TerminalService.ts`** -- Creates and manages VS Code integrated terminals, executes commands, captures output via shell integration.

**`webview/WebviewProvider.ts`** -- Implements `vscode.WebviewViewProvider`, loads the React app, manages the message bridge between the extension host and the webview.

**`state/StateManager.ts`** -- Singleton managing in-memory state with debounced persistence to `globalState` / filesystem. Holds active conversations, settings, history.

**`security/ApprovalService.ts`** -- Manages the approval flow for dangerous operations (file writes, command execution). In auto-approve mode, most operations are approved implicitly; in safe mode, the user is prompted through the webview.

---

## 3. LLM Provider Abstraction

### 3.1 Design Philosophy

All local LLM servers expose some variant of the OpenAI `/v1/chat/completions` API. However, they differ in:

- **Tool/function calling support**: LM Studio supports strict mode; Ollama's is unreliable with small models; vLLM only supports named function calling; llama.cpp uses guided decoding.
- **Model name formats**: Ollama uses `model:tag`, LM Studio uses filesystem paths, vLLM uses HuggingFace IDs.
- **Context window behavior**: Ollama silently truncates; others may return errors.
- **Authentication**: Local servers typically need no API key.
- **Streaming**: All support SSE, but chunking behaviors differ.

The provider layer normalizes all of this behind a single interface, with backend-specific adapters handling the quirks.

### 3.2 Core Interface

```typescript
// src/core/llm/types.ts

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

export interface CompletionRequest {
    model: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
    temperature?: number;
    max_tokens?: number;
    stream: boolean;
    stop?: string[];
}

export interface CompletionChunk {
    id: string;
    choices: Array<{
        delta: {
            content?: string | null;
            tool_calls?: Partial<ToolCall>[];
        };
        finish_reason: string | null;
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface CompletionResponse {
    id: string;
    choices: Array<{
        message: ChatMessage;
        finish_reason: string;
    }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ModelInfo {
    id: string;
    name: string;
    contextWindow: number;
    supportsToolCalling: boolean;
    supportsStreaming: boolean;
}

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>; // JSON Schema
    };
}
```

```typescript
// src/core/llm/LlmProvider.ts

export interface LlmProvider {
    /** Unique identifier for this provider instance */
    readonly id: string;

    /** Human-readable name */
    readonly name: string;

    /** Check if the server is reachable */
    testConnection(): Promise<{ ok: boolean; error?: string }>;

    /** List available models from the server */
    listModels(): Promise<ModelInfo[]>;

    /** Send a streaming completion request. Returns an async iterable of chunks. */
    streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk>;

    /** Send a non-streaming completion request. */
    complete(request: CompletionRequest): Promise<CompletionResponse>;

    /** Count tokens for the given text (approximate for local models). */
    countTokens(text: string): number;

    /** Get capability info for a specific model */
    getModelInfo(modelId: string): Promise<ModelInfo | null>;

    /** Dispose of any resources */
    dispose(): void;
}
```

### 3.3 Backend Adapters

Each backend adapter extends `OpenAiCompatibleProvider` and overrides only what differs.

```typescript
// src/core/llm/OpenAiCompatibleProvider.ts

export class OpenAiCompatibleProvider implements LlmProvider {
    protected baseUrl: string;
    protected apiKey: string;
    protected backend: BackendAdapter;

    constructor(config: ProviderConfig) {
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey || 'not-needed';
        this.backend = this.createBackend(config.backendType);
    }

    async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
        // Transform request through backend adapter
        const transformedRequest = this.backend.transformRequest(request);

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ ...transformedRequest, stream: true }),
            signal: AbortSignal.timeout(300_000), // 5 min timeout
        });

        if (!response.ok) {
            throw new LlmApiError(response.status, await response.text());
        }

        // Parse SSE stream
        yield* this.parseSSEStream(response.body!, request);
    }

    private async *parseSSEStream(
        body: ReadableStream<Uint8Array>,
        originalRequest: CompletionRequest
    ): AsyncIterable<CompletionChunk> {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') return;
                        try {
                            const chunk = JSON.parse(data) as CompletionChunk;
                            yield this.backend.transformChunk(chunk, originalRequest);
                        } catch {
                            // Skip malformed chunks
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    // ... listModels(), testConnection(), etc.
}
```

```typescript
// src/core/llm/backends/OllamaBackend.ts

export class OllamaBackend implements BackendAdapter {
    transformRequest(request: CompletionRequest): CompletionRequest {
        // Ollama quirk: silently discards tokens beyond context window.
        // We handle this by pre-truncating in ContextManager.
        // Ollama quirk: tool_choice 'required' not supported on some models.
        if (request.tool_choice === 'required') {
            return { ...request, tool_choice: 'auto' };
        }
        return request;
    }

    transformChunk(chunk: CompletionChunk): CompletionChunk {
        // Ollama may not return usage in streaming mode
        return chunk;
    }

    async listModels(baseUrl: string): Promise<ModelInfo[]> {
        // Ollama has /api/tags in addition to /v1/models
        const response = await fetch(`${baseUrl}/api/tags`);
        const data = await response.json();
        return data.models.map((m: any) => ({
            id: m.name,
            name: m.name,
            contextWindow: m.details?.context_length || 4096,
            supportsToolCalling: this.checkToolCallSupport(m),
            supportsStreaming: true,
        }));
    }

    private checkToolCallSupport(model: any): boolean {
        // Heuristic: larger models (7B+) generally support tool calling better
        // User can override this in settings
        return true; // Optimistic default; XML fallback handles failures
    }
}
```

### 3.4 Tool Calling Strategy -- Dual-Mode

This is a critical design decision. Since tool calling reliability varies dramatically across local models, we implement a dual-mode strategy:

**Mode 1: Native Function Calling** -- Used when the model/backend supports it. Tools are passed as `tools` parameter in the API request. The LLM returns structured `tool_calls` in its response.

**Mode 2: XML Prompt-Based Tool Calling** -- Fallback for models without reliable function calling. Tools are described in the system prompt using XML format. The LLM returns tool calls as XML blocks in its text response, which we parse.

```typescript
// src/core/agent/AgentLoop.ts (simplified)

private buildCompletionRequest(messages: ChatMessage[]): CompletionRequest {
    const modelInfo = this.provider.getModelInfo(this.model);

    if (modelInfo.supportsToolCalling && this.settings.preferNativeToolCalling) {
        // Mode 1: Native function calling
        return {
            model: this.model,
            messages,
            tools: this.toolRegistry.getToolDefinitions(),
            tool_choice: 'auto',
            stream: true,
        };
    } else {
        // Mode 2: XML prompt-based tool calling
        // Tools are embedded in the system prompt as XML descriptions
        const systemMessage = this.systemPrompt.buildWithXmlTools(
            this.toolRegistry.getToolDescriptions()
        );
        return {
            model: this.model,
            messages: [{ role: 'system', content: systemMessage }, ...messages],
            stream: true,
            stop: ['</tool_call>'], // Stop at end of tool call to parse
        };
    }
}
```

XML tool calling format in system prompt:

```xml
You have access to the following tools. To use a tool, respond with:

<tool_call>
<tool_name>tool_name_here</tool_name>
<parameters>
<param_name>value</param_name>
</parameters>
</tool_call>

Available tools:

<tool name="read_file">
<description>Read the contents of a file at the given path.</description>
<parameters>
  <parameter name="path" type="string" required="true">
    Absolute path to the file to read.
  </parameter>
</parameters>
</tool>

<!-- ... more tools ... -->
```

### 3.5 Provider Registry

```typescript
// src/core/llm/ProviderRegistry.ts

export class ProviderRegistry {
    private providers = new Map<string, LlmProvider>();

    register(config: ProviderConfig): LlmProvider {
        const provider = new OpenAiCompatibleProvider(config);
        this.providers.set(config.id, provider);
        return provider;
    }

    get(id: string): LlmProvider | undefined {
        return this.providers.get(id);
    }

    getActive(): LlmProvider {
        const activeId = this.settingsManager.get('activeProviderId');
        const provider = this.providers.get(activeId);
        if (!provider) throw new Error(`No provider configured with id: ${activeId}`);
        return provider;
    }

    async discoverModels(providerId: string): Promise<ModelInfo[]> {
        const provider = this.providers.get(providerId);
        if (!provider) return [];
        return provider.listModels();
    }
}
```

---

## 4. Agentic Loop Design

### 4.1 Overview

The agentic loop is the heart of the system. It implements an autonomous cycle where the agent:

1. Receives a user message
2. Builds context (system prompt + history + file context)
3. Sends to LLM
4. Parses response (text and/or tool calls)
5. Executes tool calls (with approval if needed)
6. Feeds tool results back to the LLM
7. Repeats until the LLM signals completion or a limit is reached

### 4.2 State Machine

```
                    ┌─────────────┐
                    │    IDLE      │
                    └──────┬──────┘
                           │ user sends message
                    ┌──────▼──────┐
              ┌─────│  THINKING   │◄────────────┐
              │     └──────┬──────┘              │
              │            │ LLM responds        │
              │     ┌──────▼──────┐              │
              │     │  PARSING    │              │
              │     └──┬──────┬───┘              │
              │        │      │                  │
              │   text only   has tool_calls     │
              │        │      │                  │
              │        │ ┌────▼─────┐            │
              │        │ │ EXECUTING│            │
              │        │ │  TOOLS   │            │
              │        │ └────┬─────┘            │
              │        │      │ tool results     │
              │        │      └──────────────────┘
              │        │
              │  ┌─────▼─────┐
              │  │ RESPONDING │ (final text to user)
              │  └─────┬─────┘
              │        │
              │  ┌─────▼─────┐
              └──│ COMPLETED  │
           or    └────────────┘
          cancel/error
```

### 4.3 AgentLoop Implementation

```typescript
// src/core/agent/AgentLoop.ts

export class AgentLoop {
    private state: TaskState = TaskState.IDLE;
    private conversationHistory: ConversationHistory;
    private contextManager: ContextManager;
    private toolExecutor: ToolExecutor;
    private provider: LlmProvider;
    private abortController: AbortController | null = null;
    private iterationCount = 0;
    private readonly maxIterations: number;

    // Event emitter for UI updates
    private readonly onStateChange: EventEmitter<AgentStateEvent>;
    private readonly onStreamChunk: EventEmitter<StreamChunkEvent>;
    private readonly onToolCall: EventEmitter<ToolCallEvent>;
    private readonly onError: EventEmitter<ErrorEvent>;

    constructor(deps: AgentLoopDependencies) {
        this.provider = deps.provider;
        this.contextManager = deps.contextManager;
        this.toolExecutor = deps.toolExecutor;
        this.conversationHistory = deps.conversationHistory;
        this.maxIterations = deps.settings.maxIterations || 25;
        this.onStateChange = deps.onStateChange;
        this.onStreamChunk = deps.onStreamChunk;
        this.onToolCall = deps.onToolCall;
        this.onError = deps.onError;
    }

    async run(userMessage: string): Promise<void> {
        this.abortController = new AbortController();
        this.iterationCount = 0;

        // Add user message to history
        this.conversationHistory.addMessage({ role: 'user', content: userMessage });

        try {
            await this.agentLoop();
        } catch (error) {
            if (error instanceof AbortError) {
                this.setState(TaskState.CANCELLED);
            } else {
                this.onError.fire({ error });
                this.setState(TaskState.ERROR);
            }
        }
    }

    private async agentLoop(): Promise<void> {
        while (this.iterationCount < this.maxIterations) {
            this.checkAborted();
            this.iterationCount++;

            // --- Step 1: Check context budget, compact if needed ---
            await this.contextManager.ensureBudget(this.conversationHistory);

            // --- Step 2: Build messages array ---
            const messages = this.contextManager.buildMessages(
                this.conversationHistory
            );

            // --- Step 3: Send to LLM (streaming) ---
            this.setState(TaskState.THINKING);
            const { textContent, toolCalls } = await this.streamCompletion(messages);

            // --- Step 4: Add assistant response to history ---
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: textContent || null,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            };
            this.conversationHistory.addMessage(assistantMessage);

            // --- Step 5: If there are tool calls, execute them ---
            if (toolCalls.length > 0) {
                this.setState(TaskState.EXECUTING_TOOLS);
                const toolResults = await this.executeToolCalls(toolCalls);

                // Add tool results to history
                for (const result of toolResults) {
                    this.conversationHistory.addMessage({
                        role: 'tool',
                        tool_call_id: result.toolCallId,
                        content: result.output,
                    });
                }

                // Check if task_complete tool was called
                if (toolResults.some(r => r.toolName === 'task_complete')) {
                    this.setState(TaskState.COMPLETED);
                    return;
                }

                // Continue the loop -- feed results back to LLM
                continue;
            }

            // --- Step 6: No tool calls -- this is the final response ---
            this.setState(TaskState.COMPLETED);
            return;
        }

        // Hit iteration limit
        this.onError.fire({
            error: new Error(`Agent reached maximum iterations (${this.maxIterations})`)
        });
        this.setState(TaskState.COMPLETED);
    }

    private async streamCompletion(
        messages: ChatMessage[]
    ): Promise<{ textContent: string; toolCalls: ToolCall[] }> {
        let textContent = '';
        const toolCallAccumulator = new ToolCallAccumulator();

        const request = this.buildCompletionRequest(messages);

        for await (const chunk of this.provider.streamCompletion(request)) {
            this.checkAborted();

            for (const choice of chunk.choices) {
                // Accumulate text
                if (choice.delta.content) {
                    textContent += choice.delta.content;
                    this.onStreamChunk.fire({
                        type: 'text',
                        content: choice.delta.content,
                    });
                }

                // Accumulate tool call deltas
                if (choice.delta.tool_calls) {
                    for (const tc of choice.delta.tool_calls) {
                        toolCallAccumulator.addDelta(tc);
                    }
                }
            }
        }

        // If using XML mode, parse tool calls from text
        let toolCalls = toolCallAccumulator.getCompleted();
        if (toolCalls.length === 0 && textContent.includes('<tool_call>')) {
            toolCalls = this.parseXmlToolCalls(textContent);
            // Strip tool call XML from display text
            textContent = this.stripToolCallXml(textContent);
        }

        return { textContent, toolCalls };
    }

    cancel(): void {
        this.abortController?.abort();
    }

    private checkAborted(): void {
        if (this.abortController?.signal.aborted) {
            throw new AbortError('Agent loop cancelled');
        }
    }
}
```

### 4.4 Tool Call Accumulator

Streaming tool calls arrive in delta chunks. This class reassembles them.

```typescript
// src/core/agent/StreamProcessor.ts

export class ToolCallAccumulator {
    private inProgress = new Map<number, {
        id: string;
        functionName: string;
        argumentsBuffer: string;
    }>();

    addDelta(delta: Partial<ToolCall> & { index?: number }): void {
        const index = delta.index ?? 0;

        if (!this.inProgress.has(index)) {
            this.inProgress.set(index, {
                id: delta.id || `call_${index}`,
                functionName: delta.function?.name || '',
                argumentsBuffer: '',
            });
        }

        const entry = this.inProgress.get(index)!;
        if (delta.function?.name) entry.functionName = delta.function.name;
        if (delta.function?.arguments) entry.argumentsBuffer += delta.function.arguments;
    }

    getCompleted(): ToolCall[] {
        return Array.from(this.inProgress.values()).map(entry => ({
            id: entry.id,
            type: 'function' as const,
            function: {
                name: entry.functionName,
                arguments: entry.argumentsBuffer,
            },
        }));
    }
}
```

---

## 5. Tool System

### 5.1 Tool Interface

```typescript
// src/core/tools/types.ts

export interface Tool {
    /** Unique tool name (used in function calling) */
    name: string;

    /** Human-readable description for the LLM */
    description: string;

    /** JSON Schema for the tool's parameters */
    parameterSchema: Record<string, unknown>;

    /** Whether this tool requires user approval before execution */
    requiresApproval: boolean;

    /** Execute the tool with the given parameters */
    execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
    workspaceRoot: string;
    abortSignal: AbortSignal;
    approvalService: ApprovalService;
    onProgress: (message: string) => void;
}

export interface ToolResult {
    success: boolean;
    output: string;
    /** Optional metadata for the UI (e.g., file paths affected) */
    metadata?: Record<string, unknown>;
}
```

### 5.2 Tool Definitions

| Tool Name | Description | Approval | Parameters |
|-----------|-------------|----------|------------|
| `read_file` | Read contents of a file | No | `path: string`, `startLine?: number`, `endLine?: number` |
| `write_file` | Create or overwrite a file | Yes | `path: string`, `content: string` |
| `edit_file` | Apply search/replace edits to a file | Yes | `path: string`, `edits: SearchReplaceBlock[]` |
| `execute_command` | Run a shell command in the terminal | Yes | `command: string`, `cwd?: string` |
| `search_files` | Search for text patterns across files | No | `pattern: string`, `path?: string`, `filePattern?: string` |
| `list_files` | List files in a directory | No | `path: string`, `recursive?: boolean` |
| `run_tests` | Execute the project's test suite | Yes | `testCommand?: string`, `testFile?: string` |
| `ask_user` | Ask the user a question and wait for response | No | `question: string` |
| `task_complete` | Signal that the task is finished | No | `summary: string` |

### 5.3 Tool Implementations (key examples)

```typescript
// src/core/tools/handlers/ReadFileTool.ts

export class ReadFileTool implements Tool {
    name = 'read_file';
    description = 'Read the contents of a file at the given path. Returns the file content with line numbers.';
    requiresApproval = false;

    parameterSchema = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Absolute or workspace-relative file path' },
            startLine: { type: 'number', description: 'Start line number (1-based, optional)' },
            endLine: { type: 'number', description: 'End line number (inclusive, optional)' },
        },
        required: ['path'],
    };

    constructor(private workspaceService: WorkspaceService, private ignoreService: IgnoreService) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const path = this.resolvePath(params.path as string, context.workspaceRoot);

        // Security check
        if (this.ignoreService.isIgnored(path)) {
            return { success: false, output: `Access denied: ${path} is in the ignore list.` };
        }

        try {
            const content = await this.workspaceService.readFile(path);
            const lines = content.split('\n');
            const start = (params.startLine as number) || 1;
            const end = (params.endLine as number) || lines.length;
            const slice = lines.slice(start - 1, end);

            // Add line numbers
            const numbered = slice.map((line, i) => `${start + i}: ${line}`).join('\n');

            return {
                success: true,
                output: numbered,
                metadata: { path, lineCount: slice.length },
            };
        } catch (error) {
            return {
                success: false,
                output: `Error reading file: ${(error as Error).message}`,
            };
        }
    }
}
```

```typescript
// src/core/tools/handlers/EditFileTool.ts

export class EditFileTool implements Tool {
    name = 'edit_file';
    description = 'Apply search/replace edits to a file. Each edit specifies a SEARCH block (exact text to find) and a REPLACE block (text to replace it with).';
    requiresApproval = true;

    parameterSchema = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'File path to edit' },
            edits: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        search: { type: 'string', description: 'Exact text to search for' },
                        replace: { type: 'string', description: 'Text to replace with' },
                    },
                    required: ['search', 'replace'],
                },
                description: 'Array of search/replace blocks',
            },
        },
        required: ['path', 'edits'],
    };

    constructor(
        private workspaceService: WorkspaceService,
        private diffPreview: DiffPreview,
        private ignoreService: IgnoreService,
    ) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const path = this.resolvePath(params.path as string, context.workspaceRoot);
        const edits = params.edits as Array<{ search: string; replace: string }>;

        if (this.ignoreService.isIgnored(path)) {
            return { success: false, output: `Access denied: ${path} is in the ignore list.` };
        }

        // Read original content
        const original = await this.workspaceService.readFile(path);
        let modified = original;

        // Apply each search/replace
        const results: string[] = [];
        for (const edit of edits) {
            const index = modified.indexOf(edit.search);
            if (index === -1) {
                results.push(`WARNING: Could not find search text: "${edit.search.substring(0, 50)}..."`);
                continue;
            }
            modified = modified.substring(0, index) + edit.replace + modified.substring(index + edit.search.length);
            results.push(`Applied edit at offset ${index}`);
        }

        if (modified === original) {
            return { success: false, output: 'No changes were applied. Search text not found.' };
        }

        // Show diff preview and request approval
        const approved = await context.approvalService.requestApproval({
            type: 'file_edit',
            path,
            diff: this.generateDiff(original, modified, path),
        });

        if (!approved) {
            return { success: false, output: 'User rejected the edit.' };
        }

        // Apply the edit
        await this.workspaceService.writeFile(path, modified);

        return {
            success: true,
            output: `File edited: ${path}\n${results.join('\n')}`,
            metadata: { path, editCount: edits.length },
        };
    }
}
```

```typescript
// src/core/tools/handlers/ExecuteCommandTool.ts

export class ExecuteCommandTool implements Tool {
    name = 'execute_command';
    description = 'Run a shell command in the integrated terminal. Returns the command output.';
    requiresApproval = true;

    parameterSchema = {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The shell command to execute' },
            cwd: { type: 'string', description: 'Working directory (defaults to workspace root)' },
        },
        required: ['command'],
    };

    constructor(
        private terminalService: TerminalService,
        private commandSanitizer: CommandSanitizer,
    ) {}

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        const command = params.command as string;
        const cwd = (params.cwd as string) || context.workspaceRoot;

        // Security: sanitize command
        const sanitized = this.commandSanitizer.sanitize(command);
        if (!sanitized.safe) {
            return {
                success: false,
                output: `Command blocked: ${sanitized.reason}`,
            };
        }

        // Request approval
        const approved = await context.approvalService.requestApproval({
            type: 'command_execution',
            command,
            cwd,
        });

        if (!approved) {
            return { success: false, output: 'User rejected the command.' };
        }

        try {
            const result = await this.terminalService.executeCommand(command, {
                cwd,
                timeout: 120_000, // 2 minute timeout
                signal: context.abortSignal,
            });

            return {
                success: result.exitCode === 0,
                output: this.truncateOutput(result.stdout + result.stderr, 8000),
                metadata: { exitCode: result.exitCode },
            };
        } catch (error) {
            return {
                success: false,
                output: `Command execution failed: ${(error as Error).message}`,
            };
        }
    }

    private truncateOutput(output: string, maxChars: number): string {
        if (output.length <= maxChars) return output;
        const half = Math.floor(maxChars / 2);
        return output.slice(0, half) + '\n\n... [truncated] ...\n\n' + output.slice(-half);
    }
}
```

### 5.4 Tool Registry and Executor

```typescript
// src/core/tools/ToolRegistry.ts

export class ToolRegistry {
    private tools = new Map<string, Tool>();

    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    /** Get OpenAI-compatible tool definitions for function calling */
    getToolDefinitions(): ToolDefinition[] {
        return this.getAll().map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameterSchema,
            },
        }));
    }

    /** Get XML descriptions for prompt-based tool calling */
    getToolDescriptions(): string {
        return this.getAll().map(tool =>
            `<tool name="${tool.name}">
<description>${tool.description}</description>
<parameters>${JSON.stringify(tool.parameterSchema, null, 2)}</parameters>
</tool>`
        ).join('\n\n');
    }
}
```

```typescript
// src/core/tools/ToolExecutor.ts

export class ToolExecutor {
    constructor(
        private registry: ToolRegistry,
        private validator: ToolValidator,
    ) {}

    async execute(
        toolCall: ToolCall,
        context: ToolContext
    ): Promise<{ toolCallId: string; toolName: string; output: string }> {
        const tool = this.registry.get(toolCall.function.name);
        if (!tool) {
            return {
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                output: `Error: Unknown tool "${toolCall.function.name}"`,
            };
        }

        // Parse and validate parameters
        let params: Record<string, unknown>;
        try {
            params = JSON.parse(toolCall.function.arguments);
        } catch {
            return {
                toolCallId: toolCall.id,
                toolName: tool.name,
                output: `Error: Invalid JSON in tool arguments`,
            };
        }

        const validation = this.validator.validate(tool, params);
        if (!validation.valid) {
            return {
                toolCallId: toolCall.id,
                toolName: tool.name,
                output: `Error: Invalid parameters: ${validation.errors.join(', ')}`,
            };
        }

        // Execute
        const result = await tool.execute(params, context);

        return {
            toolCallId: toolCall.id,
            toolName: tool.name,
            output: result.output,
        };
    }
}
```

---

## 6. Diff/Patch System

### 6.1 Design

The diff system handles three scenarios:

1. **Full file write** (`write_file` tool) -- The LLM generates the complete new file content. We show a diff between old and new in VS Code's built-in diff editor.
2. **Search/Replace editing** (`edit_file` tool) -- The LLM specifies exact text blocks to find and replace. This is the primary editing mechanism because it uses fewer tokens than generating full files.
3. **Unified diff application** (future) -- For advanced models that can produce proper unified diffs.

### 6.2 Search/Replace Block Format

This is the format the LLM uses for edits (passed in the `edit_file` tool parameters):

```json
{
    "path": "src/utils/math.ts",
    "edits": [
        {
            "search": "function add(a: number, b: number): number {\n    return a + b;\n}",
            "replace": "function add(a: number, b: number): number {\n    // Validate inputs\n    if (typeof a !== 'number' || typeof b !== 'number') {\n        throw new TypeError('Arguments must be numbers');\n    }\n    return a + b;\n}"
        }
    ]
}
```

### 6.3 Diff Preview Integration

```typescript
// src/core/diff/DiffPreview.ts

export class DiffPreview {
    constructor(private editorService: EditorService) {}

    /**
     * Show a diff preview in VS Code's built-in diff editor.
     * Returns a Promise that resolves when the user accepts or rejects.
     */
    async showDiffPreview(
        filePath: string,
        originalContent: string,
        modifiedContent: string
    ): Promise<void> {
        // Create virtual documents for the diff view
        const originalUri = vscode.Uri.parse(
            `localllm-original:${filePath}`
        );
        const modifiedUri = vscode.Uri.parse(
            `localllm-modified:${filePath}`
        );

        // Register content providers (done once at activation)
        // Show diff editor
        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            modifiedUri,
            `${path.basename(filePath)} (Proposed Changes)`,
            { preview: true }
        );
    }
}
```

### 6.4 Diff Generation for Display

```typescript
// src/core/diff/DiffGenerator.ts

import { createPatch } from 'diff'; // npm package 'diff'

export class DiffGenerator {
    /**
     * Generate a unified diff string for display in the chat UI
     */
    generateUnifiedDiff(
        filePath: string,
        original: string,
        modified: string,
        contextLines: number = 3
    ): string {
        return createPatch(
            filePath,
            original,
            modified,
            'original',
            'modified',
            { context: contextLines }
        );
    }

    /**
     * Generate a structured diff for the webview to render
     */
    generateStructuredDiff(
        original: string,
        modified: string
    ): DiffHunk[] {
        // Use jsdiff to get change objects
        const changes = diffLines(original, modified);
        const hunks: DiffHunk[] = [];
        let currentHunk: DiffHunk | null = null;
        let lineNum = 1;

        for (const change of changes) {
            if (change.added || change.removed) {
                if (!currentHunk) {
                    currentHunk = { startLine: lineNum, lines: [] };
                }
                const lines = change.value.split('\n').filter(l => l !== '');
                for (const line of lines) {
                    currentHunk.lines.push({
                        type: change.added ? 'add' : 'remove',
                        content: line,
                        lineNumber: lineNum,
                    });
                }
            } else {
                if (currentHunk) {
                    hunks.push(currentHunk);
                    currentHunk = null;
                }
            }
            if (!change.added) {
                lineNum += (change.count || 0);
            }
        }

        if (currentHunk) hunks.push(currentHunk);
        return hunks;
    }
}
```

---

## 7. Context Management

### 7.1 Token Budget Calculation

```typescript
// src/core/context/ContextManager.ts

export class ContextManager {
    private tokenCounter: TokenCounter;

    constructor(
        private provider: LlmProvider,
        private settings: ContextSettings,
    ) {
        this.tokenCounter = new TokenCounter();
    }

    /**
     * Calculate the available token budget.
     *
     * Formula: budget = min(contextWindow - reservedForOutput, contextWindow * 0.8)
     *
     * The reservedForOutput is typically 4096 tokens for the LLM's response.
     * The 0.8 multiplier is a safety margin to avoid silent truncation
     * (especially with Ollama).
     */
    getTokenBudget(modelInfo: ModelInfo): number {
        const reservedForOutput = this.settings.maxOutputTokens || 4096;
        const safetyMargin = this.settings.contextSafetyRatio || 0.8;
        return Math.min(
            modelInfo.contextWindow - reservedForOutput,
            Math.floor(modelInfo.contextWindow * safetyMargin)
        );
    }

    /**
     * Ensure the conversation fits within the token budget.
     * If it exceeds 80% of the budget, trigger compaction.
     */
    async ensureBudget(history: ConversationHistory): Promise<void> {
        const budget = this.getTokenBudget(await this.provider.getModelInfo(this.settings.modelId));
        const currentTokens = this.countHistoryTokens(history);

        if (currentTokens > budget * 0.8) {
            await this.compact(history, budget);
        }
    }

    /**
     * Build the full messages array for the LLM request.
     * Includes: system prompt + conversation history (possibly compacted).
     */
    buildMessages(history: ConversationHistory): ChatMessage[] {
        const systemMessage: ChatMessage = {
            role: 'system',
            content: this.settings.systemPrompt,
        };
        return [systemMessage, ...history.getMessages()];
    }

    private countHistoryTokens(history: ConversationHistory): number {
        let total = this.tokenCounter.count(this.settings.systemPrompt);
        for (const msg of history.getMessages()) {
            total += this.tokenCounter.count(
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg)
            );
            // Account for tool call overhead
            if (msg.tool_calls) {
                total += this.tokenCounter.count(JSON.stringify(msg.tool_calls));
            }
        }
        return total;
    }
}
```

### 7.2 Auto-Compaction

When the conversation grows too long, we summarize older messages rather than truncating them.

```typescript
// src/core/context/ContextCompactor.ts

export class ContextCompactor {
    constructor(private provider: LlmProvider) {}

    /**
     * Compact the conversation by summarizing older messages.
     * Strategy:
     * 1. Keep the system prompt intact
     * 2. Keep the most recent N messages intact (preserves immediate context)
     * 3. Summarize everything in between into a single "context summary" message
     */
    async compact(
        history: ConversationHistory,
        targetBudget: number,
        tokenCounter: TokenCounter
    ): Promise<void> {
        const messages = history.getMessages();
        const keepRecentCount = 6; // Keep last 6 messages (3 turns)

        if (messages.length <= keepRecentCount) return; // Nothing to compact

        const olderMessages = messages.slice(0, -keepRecentCount);
        const recentMessages = messages.slice(-keepRecentCount);

        // Build a summary request
        const summaryPrompt = `Summarize the following conversation context concisely. 
Focus on: what task the user requested, what files were read/modified, 
what commands were run, and the current state of progress. 
Be specific about file paths and changes made.

Conversation to summarize:
${olderMessages.map(m => `[${m.role}]: ${m.content || JSON.stringify(m.tool_calls)}`).join('\n\n')}`;

        const summaryResponse = await this.provider.complete({
            model: this.provider.id,
            messages: [
                { role: 'system', content: 'You are a helpful assistant that creates concise conversation summaries.' },
                { role: 'user', content: summaryPrompt },
            ],
            stream: false,
            max_tokens: 1024,
        });

        const summaryText = summaryResponse.choices[0]?.message.content || '';

        // Replace older messages with the summary
        history.replaceWithSummary(summaryText, recentMessages);
    }
}
```

### 7.3 Token Counter

```typescript
// src/core/llm/TokenCounter.ts

import { encode } from 'gpt-tokenizer'; // Uses cl100k_base encoding

export class TokenCounter {
    /**
     * Count tokens using GPT tokenizer as an approximation.
     *
     * Rationale: Local models use various tokenizers (SentencePiece, BPE variants),
     * but cl100k_base provides a reasonable approximation for budget calculations.
     * The 0.8 safety ratio in ContextManager absorbs the variance.
     *
     * For exact counting per-backend, backends can override this with
     * their own /tokenize endpoint if available.
     */
    count(text: string): number {
        if (!text) return 0;
        return encode(text).length;
    }

    /**
     * Estimate tokens for a messages array (including role overhead).
     * Each message adds ~4 tokens of overhead for role/formatting.
     */
    countMessages(messages: ChatMessage[]): number {
        let total = 0;
        for (const msg of messages) {
            total += 4; // role overhead
            total += this.count(typeof msg.content === 'string' ? msg.content : '');
            if (msg.tool_calls) {
                total += this.count(JSON.stringify(msg.tool_calls));
            }
        }
        total += 2; // assistant reply priming
        return total;
    }
}
```

### 7.4 File Read Deduplication

```typescript
// src/core/context/FileContextProvider.ts

export class FileContextProvider {
    /** Tracks files already read in this conversation to avoid duplicates */
    private readFiles = new Map<string, { content: string; tokenCount: number }>();

    /**
     * Get file content, returning cached version if already read.
     * This prevents the agent from wasting tokens re-reading the same file.
     */
    getFileContent(path: string): { content: string; alreadyRead: boolean } | null {
        if (this.readFiles.has(path)) {
            return { content: this.readFiles.get(path)!.content, alreadyRead: true };
        }
        return null;
    }

    cacheFileRead(path: string, content: string, tokenCount: number): void {
        this.readFiles.set(path, { content, tokenCount });
    }

    getTotalCachedTokens(): number {
        let total = 0;
        for (const entry of this.readFiles.values()) {
            total += entry.tokenCount;
        }
        return total;
    }

    reset(): void {
        this.readFiles.clear();
    }
}
```

---

## 8. Webview Chat UI Architecture

### 8.1 Technology Stack

- **React 18** with functional components and hooks
- **Zustand** for lightweight state management (smaller than Redux, ideal for webviews)
- **Vite** for development/build of the webview bundle
- **VS Code CSS variables** for native look and feel (no external CSS framework needed)
- **react-markdown** + **react-syntax-highlighter** for rendering LLM responses
- **@vscode/codicons** for VS Code-native icons

### 8.2 WebviewProvider (Host Side)

```typescript
// src/webview/WebviewProvider.ts

export class WebviewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private messageRouter: MessageRouter;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly stateManager: StateManager,
    ) {
        this.messageRouter = new MessageRouter(stateManager);
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
            ],
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(
            (message) => this.messageRouter.handleWebviewMessage(message, this),
            undefined,
            this.context.subscriptions
        );

        // Send initial state to webview
        this.syncState();
    }

    /** Post a message to the webview */
    postMessage(message: ExtensionToWebviewMessage): void {
        this.view?.webview.postMessage(message);
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.css')
        );
        const nonce = this.generateNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   style-src ${webview.cspSource} 'unsafe-inline'; 
                   script-src 'nonce-${nonce}'; 
                   font-src ${webview.cspSource};">
    <link rel="stylesheet" href="${styleUri}">
    <title>Local LLM Agent</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private generateNonce(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }
}
```

### 8.3 React Application Structure

```typescript
// webview-ui/src/main.tsx

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

```typescript
// webview-ui/src/App.tsx

import React from 'react';
import { useExtensionState } from './hooks/useExtensionState';
import { ChatView } from './components/chat/ChatView';
import { SettingsView } from './components/settings/SettingsView';
import { HistoryView } from './components/history/HistoryView';

type ViewMode = 'chat' | 'settings' | 'history';

export function App() {
    const { state } = useExtensionState();
    const [viewMode, setViewMode] = React.useState<ViewMode>('chat');

    return (
        <div className="app-container">
            <nav className="view-nav">
                <button
                    className={viewMode === 'chat' ? 'active' : ''}
                    onClick={() => setViewMode('chat')}
                    title="Chat"
                >
                    <i className="codicon codicon-comment-discussion" />
                </button>
                <button
                    className={viewMode === 'history' ? 'active' : ''}
                    onClick={() => setViewMode('history')}
                    title="History"
                >
                    <i className="codicon codicon-history" />
                </button>
                <button
                    className={viewMode === 'settings' ? 'active' : ''}
                    onClick={() => setViewMode('settings')}
                    title="Settings"
                >
                    <i className="codicon codicon-gear" />
                </button>
            </nav>

            <main className="view-content">
                {viewMode === 'chat' && <ChatView />}
                {viewMode === 'history' && <HistoryView onSelect={() => setViewMode('chat')} />}
                {viewMode === 'settings' && <SettingsView />}
            </main>
        </div>
    );
}
```

```typescript
// webview-ui/src/components/chat/ChatView.tsx

import React, { useRef, useEffect } from 'react';
import { useStore } from '../../state/store';
import { useMessages } from '../../hooks/useMessages';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { ApprovalDialog } from '../approval/ApprovalDialog';

export function ChatView() {
    const { messages, agentState, pendingApproval } = useStore();
    const { sendMessage, approveAction, rejectAction, cancelTask } = useMessages();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const isThinking = agentState === 'thinking' || agentState === 'executing_tools';

    return (
        <div className="chat-view">
            <MessageList messages={messages} />
            <div ref={messagesEndRef} />

            {pendingApproval && (
                <ApprovalDialog
                    approval={pendingApproval}
                    onApprove={approveAction}
                    onReject={rejectAction}
                />
            )}

            <InputArea
                onSend={sendMessage}
                onCancel={cancelTask}
                disabled={isThinking}
                isThinking={isThinking}
            />
        </div>
    );
}
```

### 8.4 VS Code API Bridge

```typescript
// webview-ui/src/vscode.ts

import type { WebviewApi } from 'vscode-webview';
import type { WebviewToExtensionMessage, ExtensionToWebviewMessage } from '../../src/types/messages';

class VsCodeApiWrapper {
    private readonly vsCodeApi: WebviewApi<unknown>;

    constructor() {
        this.vsCodeApi = acquireVsCodeApi();
    }

    postMessage(message: WebviewToExtensionMessage): void {
        this.vsCodeApi.postMessage(message);
    }

    onMessage(handler: (message: ExtensionToWebviewMessage) => void): () => void {
        const listener = (event: MessageEvent<ExtensionToWebviewMessage>) => {
            handler(event.data);
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
    }

    getState<T>(): T | undefined {
        return this.vsCodeApi.getState() as T | undefined;
    }

    setState<T>(state: T): void {
        this.vsCodeApi.setState(state);
    }
}

export const vscodeApi = new VsCodeApiWrapper();
```

### 8.5 Zustand State Store

```typescript
// webview-ui/src/state/store.ts

import { create } from 'zustand';
import type { ExtensionToWebviewMessage } from '../../../src/types/messages';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCalls?: ToolCallDisplay[];
    timestamp: number;
    streaming?: boolean;
}

interface ToolCallDisplay {
    id: string;
    name: string;
    arguments: string;
    result?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
}

interface PendingApproval {
    id: string;
    type: 'file_edit' | 'file_write' | 'command_execution';
    description: string;
    details: Record<string, unknown>;
}

interface AppState {
    messages: ChatMessage[];
    agentState: 'idle' | 'thinking' | 'executing_tools' | 'waiting_approval';
    pendingApproval: PendingApproval | null;
    settings: {
        providerUrl: string;
        modelId: string;
        backendType: string;
    };
    isConnected: boolean;

    // Actions
    addMessage: (msg: ChatMessage) => void;
    updateStreamingMessage: (content: string) => void;
    setAgentState: (state: AppState['agentState']) => void;
    setPendingApproval: (approval: PendingApproval | null) => void;
    handleExtensionMessage: (msg: ExtensionToWebviewMessage) => void;
    clearMessages: () => void;
}

export const useStore = create<AppState>((set, get) => ({
    messages: [],
    agentState: 'idle',
    pendingApproval: null,
    settings: {
        providerUrl: 'http://localhost:11434',
        modelId: '',
        backendType: 'ollama',
    },
    isConnected: false,

    addMessage: (msg) => set((state) => ({
        messages: [...state.messages, msg],
    })),

    updateStreamingMessage: (content) => set((state) => {
        const messages = [...state.messages];
        const last = messages[messages.length - 1];
        if (last?.streaming) {
            messages[messages.length - 1] = { ...last, content: last.content + content };
        } else {
            messages.push({
                id: crypto.randomUUID(),
                role: 'assistant',
                content,
                timestamp: Date.now(),
                streaming: true,
            });
        }
        return { messages };
    }),

    setAgentState: (agentState) => set({ agentState }),
    setPendingApproval: (pendingApproval) => set({ pendingApproval }),
    clearMessages: () => set({ messages: [] }),

    handleExtensionMessage: (msg) => {
        const { addMessage, updateStreamingMessage, setAgentState, setPendingApproval } = get();

        switch (msg.type) {
            case 'streamChunk':
                updateStreamingMessage(msg.content);
                break;
            case 'stateChange':
                setAgentState(msg.state);
                break;
            case 'toolCallStarted':
                // Update the last assistant message with tool call info
                break;
            case 'toolCallCompleted':
                // Update tool call status in the message
                break;
            case 'approvalRequired':
                setPendingApproval(msg.approval);
                setAgentState('waiting_approval');
                break;
            case 'error':
                addMessage({
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `Error: ${msg.error}`,
                    timestamp: Date.now(),
                });
                setAgentState('idle');
                break;
            case 'syncState':
                set(msg.state);
                break;
        }
    },
}));
```

---

## 9. Message Protocol

### 9.1 Type Definitions

All messages between the extension host and webview are strongly typed.

```typescript
// src/types/messages.ts

// ============================================
// Webview -> Extension Host
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
    | { type: 'getState' }; // Request full state sync

// ============================================
// Extension Host -> Webview
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
    | { type: 'modelList'; models: ModelInfo[] }
    | { type: 'syncState'; state: SyncableState }
    | { type: 'conversationList'; conversations: ConversationSummary[] }
    | { type: 'messageAdded'; message: DisplayMessage };

// ============================================
// Shared Types
// ============================================

export type AgentState = 'idle' | 'thinking' | 'executing_tools' | 'waiting_approval' | 'error';

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

export interface ToolCallInfo {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: ToolCallInfo[];
    timestamp: number;
}

export interface ConversationSummary {
    id: string;
    title: string;
    lastMessage: string;
    timestamp: number;
    messageCount: number;
}

export interface SyncableState {
    messages: DisplayMessage[];
    agentState: AgentState;
    settings: ExtensionSettings;
    isConnected: boolean;
    activeModel: string | null;
}
```

### 9.2 MessageRouter

```typescript
// src/webview/MessageRouter.ts

export class MessageRouter {
    private agentLoop: AgentLoop | null = null;

    constructor(private stateManager: StateManager) {}

    async handleWebviewMessage(
        message: WebviewToExtensionMessage,
        webviewProvider: WebviewProvider
    ): Promise<void> {
        switch (message.type) {
            case 'sendMessage':
                await this.handleSendMessage(message.text, webviewProvider);
                break;

            case 'cancelTask':
                this.agentLoop?.cancel();
                break;

            case 'approveAction':
                this.stateManager.resolveApproval(message.approvalId, true);
                break;

            case 'rejectAction':
                this.stateManager.resolveApproval(message.approvalId, false);
                break;

            case 'updateSettings':
                await this.stateManager.updateSettings(message.settings);
                break;

            case 'testConnection':
                await this.handleTestConnection(webviewProvider);
                break;

            case 'listModels':
                await this.handleListModels(webviewProvider);
                break;

            case 'newConversation':
                this.agentLoop?.cancel();
                this.stateManager.createNewConversation();
                webviewProvider.postMessage({
                    type: 'syncState',
                    state: this.stateManager.getSyncableState(),
                });
                break;

            case 'getState':
                webviewProvider.postMessage({
                    type: 'syncState',
                    state: this.stateManager.getSyncableState(),
                });
                break;
        }
    }

    private async handleSendMessage(
        text: string,
        webviewProvider: WebviewProvider
    ): Promise<void> {
        // Add user message to UI
        const userMessage: DisplayMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };
        webviewProvider.postMessage({ type: 'messageAdded', message: userMessage });

        // Create or reuse agent loop
        if (!this.agentLoop) {
            this.agentLoop = this.createAgentLoop(webviewProvider);
        }

        await this.agentLoop.run(text);
    }

    private createAgentLoop(webviewProvider: WebviewProvider): AgentLoop {
        // Wire up events to forward to webview
        const onStreamChunk = new EventEmitter<StreamChunkEvent>();
        onStreamChunk.event((e) => {
            webviewProvider.postMessage({ type: 'streamChunk', content: e.content });
        });

        const onStateChange = new EventEmitter<AgentStateEvent>();
        onStateChange.event((e) => {
            webviewProvider.postMessage({ type: 'stateChange', state: e.state });
        });

        const onToolCall = new EventEmitter<ToolCallEvent>();
        onToolCall.event((e) => {
            webviewProvider.postMessage({ type: 'toolCallStarted', toolCall: e.toolCall });
        });

        // ... construct AgentLoop with all dependencies
        return new AgentLoop({
            provider: this.stateManager.getActiveProvider(),
            contextManager: new ContextManager(/* ... */),
            toolExecutor: new ToolExecutor(/* ... */),
            conversationHistory: this.stateManager.getActiveConversation().history,
            settings: this.stateManager.getSettings(),
            onStreamChunk,
            onStateChange,
            onToolCall,
            onError: new EventEmitter(),
        });
    }
}
```

---

## 10. State Management

### 10.1 StateManager Singleton

```typescript
// src/state/StateManager.ts

export class StateManager {
    private static instance: StateManager;

    private settings: ExtensionSettings;
    private conversations: Map<string, Conversation>;
    private activeConversationId: string | null = null;
    private providerRegistry: ProviderRegistry;
    private pendingApprovals = new Map<string, {
        resolve: (approved: boolean) => void;
    }>();

    // Debounced persistence
    private persistTimer: NodeJS.Timeout | null = null;
    private readonly persistDebounceMs = 1000;

    private constructor(private context: vscode.ExtensionContext) {
        this.settings = this.loadSettings();
        this.conversations = this.loadConversations();
        this.providerRegistry = new ProviderRegistry(this);
    }

    static initialize(context: vscode.ExtensionContext): StateManager {
        if (!StateManager.instance) {
            StateManager.instance = new StateManager(context);
        }
        return StateManager.instance;
    }

    static getInstance(): StateManager {
        if (!StateManager.instance) {
            throw new Error('StateManager not initialized');
        }
        return StateManager.instance;
    }

    // ---- Settings ----

    getSettings(): ExtensionSettings {
        return { ...this.settings };
    }

    async updateSettings(partial: Partial<ExtensionSettings>): Promise<void> {
        this.settings = { ...this.settings, ...partial };
        this.schedulePersist();
    }

    private loadSettings(): ExtensionSettings {
        const stored = this.context.globalState.get<ExtensionSettings>('settings');
        return stored || getDefaultSettings();
    }

    // ---- Conversations ----

    getActiveConversation(): Conversation {
        if (!this.activeConversationId) {
            return this.createNewConversation();
        }
        return this.conversations.get(this.activeConversationId)!;
    }

    createNewConversation(): Conversation {
        const id = crypto.randomUUID();
        const conversation: Conversation = {
            id,
            title: 'New Chat',
            history: new ConversationHistory(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.conversations.set(id, conversation);
        this.activeConversationId = id;
        this.schedulePersist();
        return conversation;
    }

    // ---- Approval Flow ----

    requestApproval(request: ApprovalRequest): Promise<boolean> {
        return new Promise((resolve) => {
            this.pendingApprovals.set(request.id, { resolve });
            // The webview will be notified via the AgentLoop's event emitter
        });
    }

    resolveApproval(approvalId: string, approved: boolean): void {
        const pending = this.pendingApprovals.get(approvalId);
        if (pending) {
            pending.resolve(approved);
            this.pendingApprovals.delete(approvalId);
        }
    }

    // ---- Persistence ----

    private schedulePersist(): void {
        if (this.persistTimer) clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => this.persist(), this.persistDebounceMs);
    }

    private async persist(): Promise<void> {
        await this.context.globalState.update('settings', this.settings);

        // Persist conversations (serialize ConversationHistory)
        const serialized = new Map<string, SerializedConversation>();
        for (const [id, conv] of this.conversations) {
            serialized.set(id, {
                id: conv.id,
                title: conv.title,
                messages: conv.history.getMessages(),
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt,
            });
        }
        await this.context.globalState.update(
            'conversations',
            Object.fromEntries(serialized)
        );
    }
}
```

### 10.2 Settings Schema

```typescript
// src/types/settings.ts

export interface ExtensionSettings {
    // Provider configuration
    provider: {
        id: string;
        backendType: 'ollama' | 'lmstudio' | 'llamacpp' | 'vllm' | 'generic';
        baseUrl: string;
        apiKey: string; // Usually empty for local
        modelId: string;
    };

    // Agent behavior
    agent: {
        maxIterations: number;           // Default: 25
        maxOutputTokens: number;         // Default: 4096
        contextSafetyRatio: number;      // Default: 0.8
        temperature: number;             // Default: 0.0 (deterministic for coding)
        preferNativeToolCalling: boolean; // Default: true
    };

    // Approval settings
    approval: {
        autoApproveReads: boolean;       // Default: true
        autoApproveWrites: boolean;      // Default: false
        autoApproveCommands: boolean;    // Default: false
        allowedCommands: string[];       // Regex patterns for auto-approved commands
        blockedCommands: string[];       // Regex patterns for always-blocked commands
    };

    // UI preferences
    ui: {
        showTokenCount: boolean;         // Default: true
        showToolCalls: boolean;          // Default: true
        theme: 'auto' | 'dark' | 'light'; // Default: 'auto'
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
```

---

## 11. Security

### 11.1 File Access Control

```typescript
// src/services/ignore/IgnoreService.ts

import ignore from 'ignore'; // npm package 'ignore'

export class IgnoreService {
    private ig: ReturnType<typeof ignore>;

    constructor(private workspaceRoot: string) {
        this.ig = ignore();
        this.loadIgnorePatterns();
    }

    private async loadIgnorePatterns(): Promise<void> {
        // Always ignore these
        this.ig.add([
            '.env',
            '.env.*',
            '**/.env',
            '**/secrets.*',
            '**/*credential*',
            '**/*secret*',
            '**/id_rsa',
            '**/*.pem',
            '**/*.key',
            'node_modules/',
            '.git/',
        ]);

        // Load .localllmignore file if it exists
        const ignorePath = path.join(this.workspaceRoot, '.localllmignore');
        try {
            const content = await fs.readFile(ignorePath, 'utf8');
            this.ig.add(content);
        } catch {
            // File doesn't exist, that's fine
        }

        // Also respect .gitignore
        const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
        try {
            const content = await fs.readFile(gitignorePath, 'utf8');
            this.ig.add(content);
        } catch {
            // File doesn't exist
        }
    }

    isIgnored(filePath: string): boolean {
        const relative = path.relative(this.workspaceRoot, filePath);
        return this.ig.ignores(relative);
    }
}
```

### 11.2 Path Validation

```typescript
// src/security/PathValidator.ts

export class PathValidator {
    constructor(private workspaceRoot: string) {}

    /**
     * Validate that a file path is safe to access.
     * - Must be within the workspace root (no path traversal)
     * - Must not be an ignored path
     * - Must not contain null bytes or other dangerous characters
     */
    validate(filePath: string): { safe: boolean; resolvedPath: string; reason?: string } {
        // Resolve to absolute path
        const resolved = path.resolve(this.workspaceRoot, filePath);

        // Check for path traversal
        if (!resolved.startsWith(this.workspaceRoot)) {
            return {
                safe: false,
                resolvedPath: resolved,
                reason: 'Path traversal detected: file is outside workspace',
            };
        }

        // Check for null bytes
        if (resolved.includes('\0')) {
            return {
                safe: false,
                resolvedPath: resolved,
                reason: 'Path contains null bytes',
            };
        }

        return { safe: true, resolvedPath: resolved };
    }
}
```

### 11.3 Command Sanitization

```typescript
// src/security/CommandSanitizer.ts

export class CommandSanitizer {
    private blockedPatterns: RegExp[];
    private warningPatterns: RegExp[];

    constructor(settings: ExtensionSettings) {
        this.blockedPatterns = [
            /rm\s+(-rf|-fr)\s+[/~]/,     // rm -rf /
            /mkfs/,                        // Format disk
            /dd\s+if=/,                    // Disk write
            />\s*\/dev\//,                 // Write to devices
            /chmod\s+777/,                 // Overly permissive
            /curl\s+.*\|\s*(ba)?sh/,       // Piping curl to shell
            /wget\s+.*\|\s*(ba)?sh/,
            ...settings.approval.blockedCommands.map(p => new RegExp(p)),
        ];

        this.warningPatterns = [
            /sudo\s/,
            /git\s+push/,
            /npm\s+publish/,
            /docker\s+rm/,
        ];
    }

    sanitize(command: string): { safe: boolean; reason?: string; warning?: string } {
        for (const pattern of this.blockedPatterns) {
            if (pattern.test(command)) {
                return {
                    safe: false,
                    reason: `Command matches blocked pattern: ${pattern.source}`,
                };
            }
        }

        for (const pattern of this.warningPatterns) {
            if (pattern.test(command)) {
                return {
                    safe: true,
                    warning: `Potentially dangerous command: matches ${pattern.source}`,
                };
            }
        }

        return { safe: true };
    }
}
```

### 11.4 Approval Service

```typescript
// src/security/ApprovalService.ts

export class ApprovalService {
    constructor(
        private settings: ExtensionSettings,
        private stateManager: StateManager,
        private webviewProvider: WebviewProvider,
    ) {}

    async requestApproval(request: ApprovalRequest): Promise<boolean> {
        // Check auto-approve settings
        if (this.shouldAutoApprove(request)) {
            return true;
        }

        // Send approval request to webview
        this.webviewProvider.postMessage({
            type: 'approvalRequired',
            approval: request,
        });

        // Wait for user response (resolved by MessageRouter)
        return this.stateManager.requestApproval(request);
    }

    private shouldAutoApprove(request: ApprovalRequest): boolean {
        switch (request.type) {
            case 'file_edit':
            case 'file_write':
                return this.settings.approval.autoApproveWrites;
            case 'command_execution':
                if (!this.settings.approval.autoApproveCommands) return false;
                // Check against allowed command patterns
                return this.settings.approval.allowedCommands.some(
                    pattern => new RegExp(pattern).test(request.details.command || '')
                );
            default:
                return false;
        }
    }
}
```

---

## 12. Extension Manifest

```jsonc
// package.json
{
    "name": "local-llm-agent",
    "displayName": "Local LLM Agent",
    "description": "Autonomous AI coding assistant powered by local LLMs (Ollama, LM Studio, llama.cpp, vLLM)",
    "version": "0.1.0",
    "publisher": "your-publisher-id",
    "license": "MIT",
    "engines": {
        "vscode": "^1.85.0"
    },
    "categories": ["AI", "Programming Languages", "Other"],
    "keywords": ["ai", "llm", "ollama", "coding assistant", "local ai", "copilot"],
    "activationEvents": [
        "onStartupFinished"
    ],
    "main": "./dist/extension.js",
    "contributes": {
        "viewsContainers": {
            "activitybar": [
                {
                    "id": "local-llm-agent",
                    "title": "Local LLM Agent",
                    "icon": "resources/icon.svg"
                }
            ]
        },
        "views": {
            "local-llm-agent": [
                {
                    "type": "webview",
                    "id": "localLlmAgent.chatView",
                    "name": "Chat",
                    "contextualTitle": "Local LLM Agent"
                }
            ]
        },
        "commands": [
            {
                "command": "localLlmAgent.newChat",
                "title": "New Chat",
                "icon": "$(add)",
                "category": "Local LLM Agent"
            },
            {
                "command": "localLlmAgent.cancelTask",
                "title": "Cancel Current Task",
                "icon": "$(debug-stop)",
                "category": "Local LLM Agent"
            },
            {
                "command": "localLlmAgent.openSettings",
                "title": "Open Settings",
                "icon": "$(gear)",
                "category": "Local LLM Agent"
            },
            {
                "command": "localLlmAgent.explainSelection",
                "title": "Explain Selected Code",
                "category": "Local LLM Agent"
            },
            {
                "command": "localLlmAgent.refactorSelection",
                "title": "Refactor Selected Code",
                "category": "Local LLM Agent"
            }
        ],
        "menus": {
            "view/title": [
                {
                    "command": "localLlmAgent.newChat",
                    "when": "view == localLlmAgent.chatView",
                    "group": "navigation"
                }
            ],
            "editor/context": [
                {
                    "command": "localLlmAgent.explainSelection",
                    "when": "editorHasSelection",
                    "group": "localLlmAgent"
                },
                {
                    "command": "localLlmAgent.refactorSelection",
                    "when": "editorHasSelection",
                    "group": "localLlmAgent"
                }
            ]
        },
        "configuration": {
            "title": "Local LLM Agent",
            "properties": {
                "localLlmAgent.provider.backendType": {
                    "type": "string",
                    "enum": ["ollama", "lmstudio", "llamacpp", "vllm", "generic"],
                    "default": "ollama",
                    "description": "Type of LLM backend server"
                },
                "localLlmAgent.provider.baseUrl": {
                    "type": "string",
                    "default": "http://localhost:11434",
                    "description": "Base URL of the LLM server"
                },
                "localLlmAgent.provider.apiKey": {
                    "type": "string",
                    "default": "",
                    "description": "API key (usually not needed for local servers)"
                },
                "localLlmAgent.provider.modelId": {
                    "type": "string",
                    "default": "",
                    "description": "Model identifier to use"
                },
                "localLlmAgent.agent.maxIterations": {
                    "type": "number",
                    "default": 25,
                    "minimum": 1,
                    "maximum": 100,
                    "description": "Maximum agent loop iterations per task"
                },
                "localLlmAgent.agent.temperature": {
                    "type": "number",
                    "default": 0.0,
                    "minimum": 0.0,
                    "maximum": 2.0,
                    "description": "LLM temperature for responses"
                },
                "localLlmAgent.approval.autoApproveWrites": {
                    "type": "boolean",
                    "default": false,
                    "description": "Automatically approve file write operations"
                },
                "localLlmAgent.approval.autoApproveCommands": {
                    "type": "boolean",
                    "default": false,
                    "description": "Automatically approve command executions"
                }
            }
        },
        "keybindings": [
            {
                "command": "localLlmAgent.newChat",
                "key": "ctrl+shift+l",
                "mac": "cmd+shift+l"
            }
        ]
    },
    "scripts": {
        "vscode:prepublish": "npm run build",
        "build": "npm run build:extension && npm run build:webview",
        "build:extension": "node esbuild.mjs --production",
        "build:webview": "cd webview-ui && npm run build",
        "dev": "concurrently \"npm run dev:extension\" \"npm run dev:webview\"",
        "dev:extension": "node esbuild.mjs --watch",
        "dev:webview": "cd webview-ui && npm run dev",
        "test": "vitest run",
        "test:watch": "vitest",
        "lint": "eslint src/ --ext .ts,.tsx",
        "package": "vsce package"
    },
    "devDependencies": {
        "@types/node": "^20.11.0",
        "@types/vscode": "^1.85.0",
        "@vscode/vsce": "^3.0.0",
        "concurrently": "^8.2.0",
        "esbuild": "^0.20.0",
        "eslint": "^8.56.0",
        "typescript": "^5.3.0",
        "vitest": "^1.2.0"
    },
    "dependencies": {
        "diff": "^5.2.0",
        "gpt-tokenizer": "^2.1.0",
        "ignore": "^5.3.0"
    }
}
```

---

## 13. Build and Development Setup

### 13.1 esbuild Configuration (Extension Host)

```javascript
// esbuild.mjs

import * as esbuild from 'esbuild';

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'], // VS Code API is provided at runtime
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !isProduction,
    minify: isProduction,
    metafile: true,
};

async function main() {
    if (isWatch) {
        const ctx = await esbuild.context(extensionConfig);
        await ctx.watch();
        console.log('[esbuild] Watching for changes...');
    } else {
        const result = await esbuild.build(extensionConfig);
        if (isProduction) {
            const text = await esbuild.analyzeMetafile(result.metafile);
            console.log(text);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
```

### 13.2 Vite Configuration (Webview)

```typescript
// webview-ui/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: path.resolve(__dirname, '..', 'dist', 'webview'),
        rollupOptions: {
            output: {
                entryFileNames: 'main.js',
                assetFileNames: 'main.[ext]',
            },
        },
        sourcemap: true,
    },
    define: {
        // Prevent React dev tools from loading in webview
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
});
```

### 13.3 TypeScript Configuration

```jsonc
// tsconfig.json (root -- extension host)
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "Node16",
        "moduleResolution": "Node16",
        "lib": ["ES2022"],
        "outDir": "./out",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "webview-ui"]
}
```

```jsonc
// webview-ui/tsconfig.json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "jsx": "react-jsx",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules"]
}
```

### 13.4 Vitest Configuration

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'test/unit/**/*.test.ts'],
        exclude: ['node_modules', 'dist', 'webview-ui'],
        setupFiles: ['test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/types/**', '**/*.test.ts'],
        },
    },
    resolve: {
        alias: {
            vscode: path.resolve(__dirname, 'test/mocks/vscode.ts'),
        },
    },
});
```

```typescript
// test/mocks/vscode.ts
// Mock of the VS Code API for unit testing

export const workspace = {
    fs: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        stat: vi.fn(),
    },
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    getConfiguration: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn(),
    })),
};

export const window = {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createTerminal: vi.fn(),
    registerWebviewViewProvider: vi.fn(),
};

export const commands = {
    registerCommand: vi.fn(),
    executeCommand: vi.fn(),
};

export const Uri = {
    file: (path: string) => ({ fsPath: path, scheme: 'file' }),
    parse: (str: string) => ({ fsPath: str, scheme: str.split(':')[0] }),
    joinPath: (...args: any[]) => ({ fsPath: args.map(a => a.fsPath || a).join('/') }),
};

export const EventEmitter = class {
    private handlers: Function[] = [];
    event = (handler: Function) => { this.handlers.push(handler); };
    fire = (data: any) => { this.handlers.forEach(h => h(data)); };
    dispose = () => { this.handlers = []; };
};

// ... additional mocks as needed
```

### 13.5 VS Code Launch Configuration

```jsonc
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}"
            ],
            "outFiles": [
                "${workspaceFolder}/dist/**/*.js"
            ],
            "preLaunchTask": "npm: dev"
        },
        {
            "name": "Run Extension Tests",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}",
                "--extensionTestsPath=${workspaceFolder}/out/test"
            ],
            "outFiles": [
                "${workspaceFolder}/out/test/**/*.js"
            ],
            "preLaunchTask": "npm: build"
        }
    ]
}
```

---

## 14. Phase-by-Phase Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Goal**: A working extension that connects to a local LLM and has basic chat.

| Step | What to Build | Files |
|------|---------------|-------|
| 1.1 | Scaffold project: package.json, tsconfig, esbuild, vite configs | `package.json`, `tsconfig.json`, `esbuild.mjs`, `webview-ui/vite.config.ts` |
| 1.2 | Extension entry point with sidebar webview registration | `src/extension.ts`, `src/webview/WebviewProvider.ts` |
| 1.3 | Minimal React webview: chat input, message display | `webview-ui/src/main.tsx`, `webview-ui/src/App.tsx`, `webview-ui/src/components/chat/ChatView.tsx`, `webview-ui/src/components/chat/InputArea.tsx`, `webview-ui/src/components/chat/MessageList.tsx` |
| 1.4 | Message protocol: postMessage bridge between extension and webview | `src/types/messages.ts`, `src/webview/MessageRouter.ts`, `webview-ui/src/vscode.ts`, `webview-ui/src/hooks/useMessages.ts` |
| 1.5 | LLM provider: OpenAI-compatible streaming client | `src/core/llm/LlmProvider.ts`, `src/core/llm/OpenAiCompatibleProvider.ts`, `src/core/llm/types.ts` |
| 1.6 | Ollama backend adapter (most common local LLM) | `src/core/llm/backends/OllamaBackend.ts` |
| 1.7 | Settings: provider URL, model selection, backend type | `src/state/SettingsManager.ts`, `src/types/settings.ts`, `webview-ui/src/components/settings/SettingsView.tsx` |
| 1.8 | Model discovery: list models from server | `src/core/llm/ProviderRegistry.ts`, `webview-ui/src/components/settings/ModelSelector.tsx` |

**Milestone**: User can open the sidebar, configure an Ollama URL, select a model, type a message, and receive a streaming response.

### Phase 2: Agentic Core (Weeks 3-4)

**Goal**: The agent can read files, search the workspace, and answer questions about code.

| Step | What to Build | Files |
|------|---------------|-------|
| 2.1 | Tool interface and registry | `src/core/tools/types.ts`, `src/core/tools/ToolRegistry.ts`, `src/core/tools/ToolExecutor.ts`, `src/core/tools/ToolValidator.ts` |
| 2.2 | read_file tool | `src/core/tools/handlers/ReadFileTool.ts`, `src/services/workspace/WorkspaceService.ts` |
| 2.3 | list_files and search_files tools | `src/core/tools/handlers/ListFilesTool.ts`, `src/core/tools/handlers/SearchFilesTool.ts`, `src/services/workspace/GlobSearch.ts` |
| 2.4 | Agent loop (core cycle: send to LLM, parse tool calls, execute, loop) | `src/core/agent/AgentLoop.ts`, `src/core/agent/TaskState.ts`, `src/core/agent/StreamProcessor.ts` |
| 2.5 | Dual-mode tool calling (native function calling + XML fallback) | Updates to `AgentLoop.ts`, `src/core/prompts/ToolPrompts.ts` |
| 2.6 | System prompt builder | `src/core/prompts/SystemPrompt.ts`, `src/core/prompts/templates/system.md` |
| 2.7 | Token counting and context budget | `src/core/llm/TokenCounter.ts`, `src/core/context/ContextManager.ts` |
| 2.8 | Tool call visualization in chat UI | `webview-ui/src/components/chat/ToolCallDisplay.tsx` |

**Milestone**: User can ask "what does the function X do in file Y?" and the agent reads the file, understands the code, and explains it.

### Phase 3: Code Editing (Weeks 5-6)

**Goal**: The agent can create and modify files with user approval.

| Step | What to Build | Files |
|------|---------------|-------|
| 3.1 | write_file tool | `src/core/tools/handlers/WriteFileTool.ts` |
| 3.2 | edit_file tool (search/replace) | `src/core/tools/handlers/EditFileTool.ts`, `src/core/diff/SearchReplace.ts` |
| 3.3 | Diff generation and display | `src/core/diff/DiffGenerator.ts`, `webview-ui/src/components/diff/DiffView.tsx` |
| 3.4 | VS Code diff preview integration | `src/core/diff/DiffPreview.ts`, `src/services/editor/EditorService.ts` |
| 3.5 | Approval flow: UI and backend | `src/security/ApprovalService.ts`, `webview-ui/src/components/approval/ApprovalDialog.tsx` |
| 3.6 | File access control (.localllmignore) | `src/services/ignore/IgnoreService.ts`, `src/security/PathValidator.ts` |

**Milestone**: User can ask "add error handling to function X" and the agent generates edits, shows a diff, and applies changes upon approval.

### Phase 4: Terminal and Testing (Weeks 7-8)

**Goal**: The agent can execute commands and run tests.

| Step | What to Build | Files |
|------|---------------|-------|
| 4.1 | Terminal service with output capture | `src/services/terminal/TerminalService.ts`, `src/services/terminal/ShellIntegration.ts` |
| 4.2 | execute_command tool | `src/core/tools/handlers/ExecuteCommandTool.ts` |
| 4.3 | Command sanitization and security | `src/security/CommandSanitizer.ts` |
| 4.4 | run_tests tool | `src/core/tools/handlers/RunTestsTool.ts` |
| 4.5 | ask_user and task_complete tools | `src/core/tools/handlers/AskUserTool.ts`, `src/core/tools/handlers/TaskCompleteTool.ts` |
| 4.6 | End-to-end flow: edit code, run tests, fix failures | Integration testing |

**Milestone**: User can say "fix the failing tests" and the agent reads test output, edits code, re-runs tests, and iterates until they pass.

### Phase 5: Context and Persistence (Weeks 9-10)

**Goal**: Smart context management and conversation persistence.

| Step | What to Build | Files |
|------|---------------|-------|
| 5.1 | Auto-compaction | `src/core/context/ContextCompactor.ts` |
| 5.2 | Conversation history persistence | `src/state/ConversationStore.ts` |
| 5.3 | Conversation history UI | `webview-ui/src/components/history/HistoryView.tsx`, `webview-ui/src/components/history/HistoryItem.tsx` |
| 5.4 | File read deduplication | `src/core/context/FileContextProvider.ts` |
| 5.5 | Document tracker (open files context) | `src/services/editor/DocumentTracker.ts` |
| 5.6 | Additional backend adapters | `src/core/llm/backends/LmStudioBackend.ts`, `src/core/llm/backends/VllmBackend.ts`, `src/core/llm/backends/LlamaCppBackend.ts` |

**Milestone**: Long conversations work without running out of context. Conversations persist across VS Code restarts. All major backends supported.

### Phase 6: Polish and Advanced Features (Weeks 11-12+)

**Goal**: Production-quality UX and advanced features.

| Step | What to Build | Files |
|------|---------------|-------|
| 6.1 | Markdown rendering in chat (code blocks, syntax highlighting) | `webview-ui/src/components/common/Markdown.tsx`, `webview-ui/src/components/common/CodeBlock.tsx` |
| 6.2 | Right-click context menu: explain/refactor selection | Commands in `extension.ts` |
| 6.3 | Streaming diff display (show edits as they stream in) | Enhancement to `DiffView.tsx` |
| 6.4 | Token usage display | Enhancement to chat UI |
| 6.5 | Design document generation tool | New tool handler |
| 6.6 | File watcher for external changes | `src/services/workspace/FileWatcher.ts` |
| 6.7 | Error recovery and retry logic | `src/utils/async.ts`, enhancements to `AgentLoop.ts` |
| 6.8 | VSIX packaging and marketplace prep | `.vscodeignore`, README, CHANGELOG |
| 6.9 | Comprehensive test suite | Unit tests across all modules |

---

## Key Architectural Decisions Summary

1. **Separate builds**: Extension host (esbuild, CJS, Node) and webview (Vite, ESM, browser) are completely separate bundles sharing only TypeScript type definitions. This prevents bundling issues and keeps the webview sandbox clean.

2. **Core has no VS Code dependency**: Everything in `src/core/` is pure TypeScript with no `import vscode`. All VS Code API access goes through `src/services/` adapters. This makes the core 100% unit-testable without mocking VS Code.

3. **Dual-mode tool calling**: Native OpenAI function calling when the model supports it; XML-in-prompt fallback when it does not. This maximizes compatibility across local LLM backends, especially smaller models.

4. **Search/replace as primary edit mechanism**: Rather than generating full files (expensive in tokens) or unified diffs (unreliable from small models), we use search/replace blocks that are unambiguous and token-efficient.

5. **Approximate token counting**: We use `gpt-tokenizer` (cl100k_base) as an approximation for all backends. The 80% safety ratio absorbs the variance between tokenizers. This avoids the complexity of backend-specific tokenization while preventing context overflow.

6. **Debounced state persistence**: State is kept in memory for performance, with debounced writes to `globalState`. This prevents excessive disk I/O during streaming.

7. **Approval as a first-class concern**: Every mutating tool (write, edit, command) goes through `ApprovalService`. Auto-approve settings provide the "full auto" mode, but the architecture always supports stepping back to manual approval.

---

### Critical Files for Implementation

- `/Users/osia/Documents/GenAIWork/VSCodeLLLM/src/core/agent/AgentLoop.ts` - Central agentic execution loop that orchestrates LLM calls, tool execution, and the recursive completion cycle. This is the most complex single file and the brain of the entire extension.
- `/Users/osia/Documents/GenAIWork/VSCodeLLLM/src/core/llm/OpenAiCompatibleProvider.ts` - The unified LLM client that handles SSE streaming, request/response transformation, and delegates to backend adapters. All LLM communication flows through this class.
- `/Users/osia/Documents/GenAIWork/VSCodeLLLM/src/webview/WebviewProvider.ts` - The bridge between VS Code and the React UI. Implements WebviewViewProvider, loads the webview HTML, and manages the postMessage communication channel.
- `/Users/osia/Documents/GenAIWork/VSCodeLLLM/src/core/tools/ToolRegistry.ts` - Tool registration, schema generation (for both native function calling and XML prompt mode), and dispatch. Every agent capability is routed through this registry.
- `/Users/osia/Documents/GenAIWork/VSCodeLLLM/src/types/messages.ts` - The complete message protocol type definitions shared between extension host and webview. Getting these types right determines the correctness of all host-webview communication.