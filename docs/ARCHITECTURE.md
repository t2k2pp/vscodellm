# Local LLM Agent - VSCode Extension 設計書

## 概要

ローカルLLM（Ollama, LM Studio, llama.cpp, vLLM）を活用した自律型AIコーディングアシスタントのVSCode拡張機能。
GitHub Copilot ChatやClineと同等の開発支援機能を、クラウドAPIに依存せずローカルで提供する。

### 設計原則

- **ローカルファースト**: クラウドAPIを一切使わず、ローカル/社内サーバーのLLMのみで動作
- **バックエンド非依存**: OpenAI互換APIを共通インターフェースとし、各バックエンドの差異を吸収
- **フルオートエージェント**: コード読解・生成・編集・テスト実行まで自律的に遂行（ユーザーは最終承認のみ）
- **クロスプラットフォーム**: Mac/Windows/Linuxで動作
- **テスト可能な設計**: コアロジックはVSCode APIに依存しない純粋TypeScript

---

## 1. プロジェクト構成

```
local-llm-agent/
├── .vscode/
│   ├── launch.json                    # デバッグ設定
│   ├── tasks.json                     # ビルドタスク
│   └── settings.json
├── src/                               # 拡張機能本体（Node.js / esbuild）
│   ├── extension.ts                   # エントリポイント
│   ├── core/                          # コアロジック（VSCode非依存）
│   │   ├── agent/
│   │   │   ├── AgentLoop.ts           # エージェント実行ループ
│   │   │   ├── TaskState.ts           # タスク状態マシン
│   │   │   ├── StreamProcessor.ts     # SSEストリーム処理
│   │   │   └── types.ts
│   │   ├── llm/
│   │   │   ├── LlmProvider.ts         # LLMプロバイダーインターフェース
│   │   │   ├── OpenAiCompatibleProvider.ts  # OpenAI互換クライアント
│   │   │   ├── ProviderRegistry.ts    # プロバイダー管理
│   │   │   ├── ModelInfo.ts           # モデルメタデータ
│   │   │   ├── TokenCounter.ts        # トークンカウント
│   │   │   ├── backends/
│   │   │   │   ├── OllamaBackend.ts
│   │   │   │   ├── LmStudioBackend.ts
│   │   │   │   ├── LlamaCppBackend.ts
│   │   │   │   ├── VllmBackend.ts
│   │   │   │   └── GenericBackend.ts  # 汎用フォールバック
│   │   │   └── types.ts
│   │   ├── tools/
│   │   │   ├── ToolRegistry.ts        # ツール登録・管理
│   │   │   ├── ToolExecutor.ts        # ツール実行ディスパッチ
│   │   │   ├── ToolValidator.ts       # パラメータバリデーション
│   │   │   ├── definitions.ts         # ツールスキーマ定義
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
│   │   │   └── types.ts
│   │   ├── diff/
│   │   │   ├── DiffGenerator.ts       # 差分生成
│   │   │   ├── DiffApplier.ts         # 差分適用
│   │   │   ├── DiffPreview.ts         # VSCode差分プレビュー連携
│   │   │   ├── SearchReplace.ts       # Search/Replaceパーサー
│   │   │   └── types.ts
│   │   ├── context/
│   │   │   ├── ContextManager.ts      # トークン予算管理
│   │   │   ├── ContextCompactor.ts    # 自動圧縮ロジック
│   │   │   ├── FileContextProvider.ts # ファイルコンテキスト取得
│   │   │   ├── ConversationHistory.ts # 会話履歴管理
│   │   │   └── types.ts
│   │   └── prompts/
│   │       ├── SystemPrompt.ts        # システムプロンプト構築
│   │       ├── ToolPrompts.ts         # XMLフォールバック用ツール記述
│   │       └── templates/
│   │           ├── system.md
│   │           ├── tool-descriptions.md
│   │           └── compaction.md
│   ├── services/                      # VSCode APIラッパー
│   │   ├── workspace/
│   │   │   ├── WorkspaceService.ts    # ファイル操作
│   │   │   ├── FileWatcher.ts         # ファイル変更監視
│   │   │   └── GlobSearch.ts          # Glob検索
│   │   ├── terminal/
│   │   │   ├── TerminalService.ts     # ターミナル管理
│   │   │   └── ShellIntegration.ts    # シェル出力キャプチャ
│   │   ├── editor/
│   │   │   ├── EditorService.ts       # エディタ操作
│   │   │   └── DocumentTracker.ts     # 開いているドキュメント追跡
│   │   └── ignore/
│   │       ├── IgnoreService.ts       # .localllmignore処理
│   │       └── patterns.ts
│   ├── webview/
│   │   ├── WebviewProvider.ts         # WebviewViewProvider実装
│   │   ├── MessageRouter.ts           # メッセージルーティング
│   │   └── WebviewStateSync.ts        # 状態同期
│   ├── state/
│   │   ├── StateManager.ts            # グローバル状態管理（シングルトン）
│   │   ├── SettingsManager.ts         # 設定管理
│   │   ├── ConversationStore.ts       # 会話永続化
│   │   └── types.ts
│   ├── security/
│   │   ├── ApprovalService.ts         # ユーザー承認フロー
│   │   ├── PathValidator.ts           # パストラバーサル防止
│   │   └── CommandSanitizer.ts        # 危険コマンドブロック
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── disposable.ts
│   │   ├── async.ts                   # リトライ・デバウンス
│   │   ├── platform.ts               # クロスプラットフォームヘルパー
│   │   └── errors.ts
│   └── types/
│       ├── index.ts
│       ├── messages.ts                # メッセージプロトコル型定義
│       ├── settings.ts
│       └── vscode.d.ts
├── webview-ui/                        # チャットUI（React / Vite）
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx                   # Reactエントリポイント
│   │   ├── App.tsx                    # ルートコンポーネント
│   │   ├── vscode.ts                  # VSCode APIブリッジ
│   │   ├── hooks/
│   │   │   ├── useExtensionState.ts
│   │   │   ├── useMessages.ts
│   │   │   └── useSettings.ts
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatView.tsx       # チャットメイン画面
│   │   │   │   ├── MessageList.tsx    # メッセージ一覧
│   │   │   │   ├── MessageBubble.tsx  # メッセージ表示
│   │   │   │   ├── InputArea.tsx      # 入力エリア
│   │   │   │   ├── StreamingMessage.tsx
│   │   │   │   └── ToolCallDisplay.tsx
│   │   │   ├── diff/
│   │   │   │   ├── DiffView.tsx
│   │   │   │   └── DiffActions.tsx    # 承認/拒否ボタン
│   │   │   ├── settings/
│   │   │   │   ├── SettingsView.tsx
│   │   │   │   ├── ProviderConfig.tsx
│   │   │   │   └── ModelSelector.tsx
│   │   │   ├── history/
│   │   │   │   ├── HistoryView.tsx
│   │   │   │   └── HistoryItem.tsx
│   │   │   ├── approval/
│   │   │   │   └── ApprovalDialog.tsx
│   │   │   └── common/
│   │   │       ├── CodeBlock.tsx
│   │   │       ├── Markdown.tsx
│   │   │       ├── Spinner.tsx
│   │   │       └── Icon.tsx
│   │   ├── state/
│   │   │   ├── store.ts              # Zustand状態管理
│   │   │   └── types.ts
│   │   └── styles/
│   │       ├── global.css
│   │       ├── chat.css
│   │       └── diff.css
│   ├── tsconfig.json
│   └── vite.config.ts
├── test/
│   ├── setup.ts
│   ├── mocks/
│   │   ├── vscode.ts                  # VSCode APIモック
│   │   └── llm.ts                     # LLM APIモック
│   ├── unit/
│   └── integration/
├── resources/
│   ├── icon.png
│   └── icon.svg
├── package.json                       # 拡張マニフェスト
├── tsconfig.json
├── esbuild.mjs
├── vitest.config.ts
├── .vscodeignore
├── .eslintrc.json
├── .prettierrc
├── CHANGELOG.md
└── LICENSE
```

### アーキテクチャ上の重要な決定

1. **2つの独立したビルドターゲット**: `src/`はesbuild→Node.jsバンドル、`webview-ui/`はVite→ブラウザバンドル。型定義のみ共有
2. **core/ はVSCode非依存**: `src/core/`はvscodeをimportしない。VSCode APIへのアクセスは全て`src/services/`経由。100%ユニットテスト可能
3. **コロケーションテスト**: ユニットテストはソースファイルの隣に配置（例: `AgentLoop.test.ts`）

---

## 2. モジュール依存関係

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

---

## 3. LLMプロバイダー抽象化層

### 3.1 設計思想

全てのローカルLLMサーバーはOpenAI `/v1/chat/completions` APIの変種を提供する。
しかし以下の差異がある:

| 差異 | 詳細 |
|------|------|
| Tool Calling対応 | LM Studio: strictモード対応, Ollama: 小モデルでは不安定, vLLM: namedのみ |
| モデル名形式 | Ollama: `model:tag`, LM Studio: ファイルパス, vLLM: HuggingFace ID |
| コンテキストウィンドウ | Ollamaは無言で切り捨て、他はエラーを返す |
| 認証 | ローカルサーバーは通常APIキー不要 |

プロバイダー層がこれらを全て正規化し、バックエンド固有アダプターが差異を処理する。

### 3.2 コアインターフェース

```typescript
// src/core/llm/LlmProvider.ts
export interface LlmProvider {
    readonly id: string;
    readonly name: string;
    testConnection(): Promise<{ ok: boolean; error?: string }>;
    listModels(): Promise<ModelInfo[]>;
    streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk>;
    complete(request: CompletionRequest): Promise<CompletionResponse>;
    countTokens(text: string): number;
    getModelInfo(modelId: string): Promise<ModelInfo | null>;
    dispose(): void;
}
```

### 3.3 バックエンドアダプター

各バックエンドアダプターは `OpenAiCompatibleProvider` を拡張し、差異のみをオーバーライドする。

```typescript
// src/core/llm/OpenAiCompatibleProvider.ts
export class OpenAiCompatibleProvider implements LlmProvider {
    protected baseUrl: string;
    protected apiKey: string;
    protected backend: BackendAdapter;

    async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
        const transformedRequest = this.backend.transformRequest(request);
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ ...transformedRequest, stream: true }),
        });
        yield* this.parseSSEStream(response.body!, request);
    }
}
```

### 3.4 Tool Callingデュアルモード戦略

ローカルモデルのTool Calling信頼性は大きく異なるため、2モード方式を採用:

**モード1: ネイティブFunction Calling** - モデル/バックエンドが対応している場合。`tools`パラメータでツールを渡し、LLMが構造化された`tool_calls`を返す。

**モード2: XMLプロンプトベース** - Function Calling非対応モデル用フォールバック。ツールをシステムプロンプトにXML形式で記述し、LLMがXMLブロックで返すのをパースする。

```xml
<!-- XMLフォールバック形式 -->
<tool_call>
<tool_name>read_file</tool_name>
<parameters>
<path>/src/index.ts</path>
</parameters>
</tool_call>
```

---

## 4. エージェントループ設計

### 4.1 状態マシン

```
                    ┌─────────────┐
                    │    IDLE      │
                    └──────┬──────┘
                           │ ユーザーメッセージ送信
                    ┌──────▼──────┐
              ┌─────│  THINKING   │◄────────────┐
              │     └──────┬──────┘              │
              │            │ LLM応答             │
              │     ┌──────▼──────┐              │
              │     │  PARSING    │              │
              │     └──┬──────┬───┘              │
              │        │      │                  │
              │   テキストのみ  tool_callsあり     │
              │        │      │                  │
              │        │ ┌────▼─────┐            │
              │        │ │ EXECUTING│            │
              │        │ │  TOOLS   │            │
              │        │ └────┬─────┘            │
              │        │      │ ツール結果        │
              │        │      └──────────────────┘
              │        │
              │  ┌─────▼─────┐
              │  │ RESPONDING │
              │  └─────┬─────┘
              │        │
              │  ┌─────▼─────┐
              └──│ COMPLETED  │
           or    └────────────┘
        cancel/error
```

### 4.2 AgentLoop実装概要

```typescript
// src/core/agent/AgentLoop.ts
export class AgentLoop {
    private state: TaskState = TaskState.IDLE;
    private iterationCount = 0;
    private readonly maxIterations: number;

    async run(userMessage: string): Promise<void> {
        this.conversationHistory.addMessage({ role: 'user', content: userMessage });
        await this.agentLoop();
    }

    private async agentLoop(): Promise<void> {
        while (this.iterationCount < this.maxIterations) {
            this.iterationCount++;

            // 1. コンテキスト予算チェック、必要なら圧縮
            await this.contextManager.ensureBudget(this.conversationHistory);

            // 2. メッセージ配列構築
            const messages = this.contextManager.buildMessages(this.conversationHistory);

            // 3. LLMにストリーミング送信
            this.setState(TaskState.THINKING);
            const { textContent, toolCalls } = await this.streamCompletion(messages);

            // 4. アシスタント応答を履歴に追加
            this.conversationHistory.addMessage({
                role: 'assistant',
                content: textContent || null,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            });

            // 5. ツール呼び出しがあれば実行
            if (toolCalls.length > 0) {
                this.setState(TaskState.EXECUTING_TOOLS);
                const toolResults = await this.executeToolCalls(toolCalls);

                // ツール結果を履歴に追加
                for (const result of toolResults) {
                    this.conversationHistory.addMessage({
                        role: 'tool',
                        tool_call_id: result.toolCallId,
                        content: result.output,
                    });
                }

                // task_completeが呼ばれたら終了
                if (toolResults.some(r => r.toolName === 'task_complete')) {
                    this.setState(TaskState.COMPLETED);
                    return;
                }
                continue; // ループ継続
            }

            // 6. ツール呼び出しなし = 最終応答
            this.setState(TaskState.COMPLETED);
            return;
        }
    }
}
```

---

## 5. ツールシステム

### 5.1 ツール一覧

| ツール名 | 説明 | 承認要否 | パラメータ |
|----------|------|----------|------------|
| `read_file` | ファイル内容を読み取り | 不要 | `path`, `startLine?`, `endLine?` |
| `write_file` | ファイルを作成/上書き | **必要** | `path`, `content` |
| `edit_file` | Search/Replaceで編集 | **必要** | `path`, `edits[]` |
| `execute_command` | シェルコマンドを実行 | **必要** | `command`, `cwd?` |
| `search_files` | テキストパターンを検索 | 不要 | `pattern`, `path?`, `filePattern?` |
| `list_files` | ディレクトリ内のファイル一覧 | 不要 | `path`, `recursive?` |
| `run_tests` | テストスイートを実行 | **必要** | `testCommand?`, `testFile?` |
| `ask_user` | ユーザーに質問 | 不要 | `question` |
| `task_complete` | タスク完了を通知 | 不要 | `summary` |

### 5.2 ツールインターフェース

```typescript
export interface Tool {
    name: string;
    description: string;
    parameterSchema: Record<string, unknown>;  // JSON Schema
    requiresApproval: boolean;
    execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolResult {
    success: boolean;
    output: string;
    metadata?: Record<string, unknown>;
}
```

### 5.3 編集方式: Search/Replace

トークン効率とLLMの信頼性を両立する主要な編集メカニズム:

```json
{
    "path": "src/utils/math.ts",
    "edits": [
        {
            "search": "function add(a: number, b: number): number {\n    return a + b;\n}",
            "replace": "function add(a: number, b: number): number {\n    if (typeof a !== 'number') throw new TypeError();\n    return a + b;\n}"
        }
    ]
}
```

理由:
- **全ファイル再生成**よりトークン消費が少ない
- **Unified Diff**より小規模モデルでも安定
- 検索テキストが一致するかどうかで曖昧さを排除

---

## 6. コンテキスト管理

### 6.1 トークン予算計算

```
予算 = min(contextWindow - reservedForOutput, contextWindow × 0.8)
```

- `reservedForOutput`: LLMの応答用に確保（デフォルト4096トークン）
- `0.8`: 安全マージン（Ollamaの無言切り捨て等を吸収）

### 6.2 自動圧縮 (Auto-Compaction)

会話がトークン予算の80%を超えたら:

1. システムプロンプトはそのまま保持
2. 最新6メッセージ（3ターン分）はそのまま保持
3. それ以前のメッセージをLLMで要約して1メッセージに圧縮

### 6.3 トークンカウント

`gpt-tokenizer`（cl100k_base）を近似値として使用。ローカルモデルのトークナイザーとは差異があるが、0.8の安全マージンで吸収する。

### 6.4 ファイル読み取り重複排除

同一ファイルの再読み取りを検出し、`[DUPLICATE FILE READ]`マーカーに置換してトークンを節約。

---

## 7. WebviewチャットUI

### 7.1 技術スタック

| ライブラリ | 用途 |
|-----------|------|
| React 18 | UIフレームワーク |
| Zustand | 軽量状態管理 |
| Vite | ビルド |
| VS Code CSS変数 | ネイティブテーマ連動 |
| react-markdown | マークダウンレンダリング |
| react-syntax-highlighter | コードハイライト |
| @vscode/codicons | アイコン |

### 7.2 画面構成

```
┌──────────────────────────┐
│ [Chat] [History] [⚙]    │ ← ナビゲーションバー
├──────────────────────────┤
│                          │
│  User: ○○してください     │
│                          │
│  Agent: ファイルを読みま... │
│  [🔧 read_file: src/...] │
│  [🔧 edit_file: src/...] │
│                          │
│  ┌──────────────────────┐│
│  │ 変更を適用しますか？  ││ ← 承認ダイアログ
│  │ [承認] [拒否]         ││
│  └──────────────────────┘│
├──────────────────────────┤
│ [メッセージを入力...]  [➤]│ ← 入力エリア
└──────────────────────────┘
```

---

## 8. メッセージプロトコル

### Webview → Extension Host

```typescript
type WebviewToExtensionMessage =
    | { type: 'sendMessage'; text: string }
    | { type: 'cancelTask' }
    | { type: 'approveAction'; approvalId: string }
    | { type: 'rejectAction'; approvalId: string }
    | { type: 'updateSettings'; settings: Partial<ExtensionSettings> }
    | { type: 'testConnection' }
    | { type: 'listModels' }
    | { type: 'loadConversation'; conversationId: string }
    | { type: 'newConversation' }
    | { type: 'getState' };
```

### Extension Host → Webview

```typescript
type ExtensionToWebviewMessage =
    | { type: 'streamChunk'; content: string }
    | { type: 'streamEnd' }
    | { type: 'stateChange'; state: AgentState }
    | { type: 'toolCallStarted'; toolCall: ToolCallInfo }
    | { type: 'toolCallCompleted'; toolCallId: string; result: string; success: boolean }
    | { type: 'approvalRequired'; approval: ApprovalRequest }
    | { type: 'error'; error: string }
    | { type: 'connectionStatus'; connected: boolean; error?: string }
    | { type: 'modelList'; models: ModelInfo[] }
    | { type: 'syncState'; state: SyncableState }
    | { type: 'messageAdded'; message: DisplayMessage };
```

---

## 9. セキュリティ

### 9.1 ファイルアクセス制御

- `.localllmignore`ファイルでアクセス制御（.gitignoreと同じ構文）
- `.gitignore`のパターンも自動的に尊重
- デフォルトでブロック: `.env`, `*credential*`, `*secret*`, `*.pem`, `*.key`, `.git/`, `node_modules/`

### 9.2 パストラバーサル防止

- 全ファイルパスをワークスペースルートからの相対パスに解決
- ワークスペース外へのアクセスをブロック
- NULLバイト含有パスを拒否

### 9.3 コマンドサニタイズ

**ブロックされるコマンド** (実行不可):
- `rm -rf /`系
- `mkfs`, `dd if=`
- `curl | sh`系のパイプ
- `chmod 777`

**警告付き実行** (ユーザー承認必須):
- `sudo`
- `git push`
- `npm publish`
- `docker rm`

### 9.4 承認フロー

全ての変更操作（ファイル書き込み、コマンド実行）は`ApprovalService`を経由:

- **セーフモード**: 毎回ユーザーに承認を求める
- **オートモード**: 設定に基づき自動承認（読み取り: 常時許可、書き込み: 設定可能、コマンド: パターンマッチで設定可能）

---

## 10. 設定スキーマ

```typescript
interface ExtensionSettings {
    provider: {
        backendType: 'ollama' | 'lmstudio' | 'llamacpp' | 'vllm' | 'generic';
        baseUrl: string;        // デフォルト: http://localhost:11434
        apiKey: string;         // ローカルでは通常空
        modelId: string;
    };
    agent: {
        maxIterations: number;           // デフォルト: 25
        maxOutputTokens: number;         // デフォルト: 4096
        contextSafetyRatio: number;      // デフォルト: 0.8
        temperature: number;             // デフォルト: 0.0
        preferNativeToolCalling: boolean; // デフォルト: true
    };
    approval: {
        autoApproveReads: boolean;       // デフォルト: true
        autoApproveWrites: boolean;      // デフォルト: false
        autoApproveCommands: boolean;    // デフォルト: false
        allowedCommands: string[];       // 正規表現パターン
        blockedCommands: string[];       // 正規表現パターン
    };
    ui: {
        showTokenCount: boolean;
        showToolCalls: boolean;
        theme: 'auto' | 'dark' | 'light';
    };
}
```

---

## 11. ビルド・開発環境

| 項目 | 選定 |
|------|------|
| 言語 | TypeScript 5.3+ |
| 拡張機能バンドル | esbuild (CJS, Node.js) |
| Webviewバンドル | Vite + React |
| テスト | Vitest |
| Lint | ESLint |
| フォーマット | Prettier |
| パッケージ | vsce |

### npm scripts

```json
{
    "build": "npm run build:extension && npm run build:webview",
    "build:extension": "node esbuild.mjs --production",
    "build:webview": "cd webview-ui && npm run build",
    "dev": "concurrently \"npm run dev:extension\" \"npm run dev:webview\"",
    "test": "vitest run",
    "package": "vsce package"
}
```

### 主要依存パッケージ

| パッケージ | 用途 |
|-----------|------|
| `diff` | 差分生成 |
| `gpt-tokenizer` | トークンカウント近似 |
| `ignore` | .gitignore/.localllmignore処理 |
| `react`, `react-dom` | Webview UI |
| `zustand` | 状態管理 |
| `react-markdown` | マークダウン表示 |

---

## 12. 実装ロードマップ

### Phase 1: 基盤構築（Week 1-2）

**ゴール**: ローカルLLMに接続してチャットできる最小限の拡張

| # | 内容 | 主要ファイル |
|---|------|-------------|
| 1.1 | プロジェクトスキャフォールド | `package.json`, `tsconfig.json`, `esbuild.mjs` |
| 1.2 | 拡張エントリポイント + サイドバー登録 | `extension.ts`, `WebviewProvider.ts` |
| 1.3 | 最小React Webview（入力・表示） | `ChatView.tsx`, `InputArea.tsx`, `MessageList.tsx` |
| 1.4 | postMessageブリッジ | `messages.ts`, `MessageRouter.ts`, `vscode.ts` |
| 1.5 | OpenAI互換ストリーミングクライアント | `LlmProvider.ts`, `OpenAiCompatibleProvider.ts` |
| 1.6 | Ollamaバックエンドアダプター | `OllamaBackend.ts` |
| 1.7 | 設定UI（URL、モデル選択） | `SettingsManager.ts`, `SettingsView.tsx` |
| 1.8 | モデル一覧取得 | `ProviderRegistry.ts`, `ModelSelector.tsx` |

**マイルストーン**: サイドバーからOllamaに接続し、チャットのやり取りができる

### Phase 2: エージェントコア（Week 3-4）

**ゴール**: ファイルを読み、コードについて回答できるエージェント

| # | 内容 | 主要ファイル |
|---|------|-------------|
| 2.1 | ツールインターフェース・レジストリ | `ToolRegistry.ts`, `ToolExecutor.ts` |
| 2.2 | read_fileツール | `ReadFileTool.ts`, `WorkspaceService.ts` |
| 2.3 | list_files, search_filesツール | `ListFilesTool.ts`, `SearchFilesTool.ts` |
| 2.4 | エージェントループ（LLM→ツール→ループ） | `AgentLoop.ts`, `TaskState.ts` |
| 2.5 | デュアルモードTool Calling | `AgentLoop.ts`, `ToolPrompts.ts` |
| 2.6 | システムプロンプト構築 | `SystemPrompt.ts`, `system.md` |
| 2.7 | トークンカウント・予算管理 | `TokenCounter.ts`, `ContextManager.ts` |
| 2.8 | ツール呼び出しのUI表示 | `ToolCallDisplay.tsx` |

**マイルストーン**: 「ファイルXの関数Yを説明して」と聞くと、エージェントがファイルを読んで説明する

### Phase 3: コード編集（Week 5-6）

**ゴール**: ファイルの作成・編集をユーザー承認付きで実行

| # | 内容 | 主要ファイル |
|---|------|-------------|
| 3.1 | write_fileツール | `WriteFileTool.ts` |
| 3.2 | edit_fileツール（Search/Replace） | `EditFileTool.ts`, `SearchReplace.ts` |
| 3.3 | 差分生成・表示 | `DiffGenerator.ts`, `DiffView.tsx` |
| 3.4 | VSCode差分プレビュー連携 | `DiffPreview.ts`, `EditorService.ts` |
| 3.5 | 承認フロー（UI+バックエンド） | `ApprovalService.ts`, `ApprovalDialog.tsx` |
| 3.6 | ファイルアクセス制御 | `IgnoreService.ts`, `PathValidator.ts` |

**マイルストーン**: 「関数Xにエラーハンドリングを追加して」→ 差分表示 → 承認 → 適用

### Phase 4: ターミナル・テスト（Week 7-8）

**ゴール**: コマンド実行とテスト実行の自動化

| # | 内容 | 主要ファイル |
|---|------|-------------|
| 4.1 | ターミナルサービス（出力キャプチャ） | `TerminalService.ts`, `ShellIntegration.ts` |
| 4.2 | execute_commandツール | `ExecuteCommandTool.ts` |
| 4.3 | コマンドサニタイズ | `CommandSanitizer.ts` |
| 4.4 | run_testsツール | `RunTestsTool.ts` |
| 4.5 | ask_user, task_completeツール | `AskUserTool.ts`, `TaskCompleteTool.ts` |
| 4.6 | E2Eフロー: 編集→テスト→修正→再テスト | 統合テスト |

**マイルストーン**: 「失敗しているテストを修正して」→ テスト出力読み→コード修正→再テスト→パスするまでループ

### Phase 5: コンテキスト・永続化（Week 9-10）

**ゴール**: 長い会話とセッション間の会話保持

| # | 内容 |
|---|------|
| 5.1 | 自動圧縮 |
| 5.2 | 会話履歴の永続化 |
| 5.3 | 会話履歴UI |
| 5.4 | ファイル読み取り重複排除 |
| 5.5 | 開いているドキュメントの追跡 |
| 5.6 | 追加バックエンドアダプター (LM Studio, vLLM, llama.cpp) |

### Phase 6: 品質向上・高度な機能（Week 11-12+）

| # | 内容 |
|---|------|
| 6.1 | Markdown/コードブロックレンダリング |
| 6.2 | 右クリックメニュー（選択コード説明/リファクタ） |
| 6.3 | ストリーミング差分表示 |
| 6.4 | トークン使用量表示 |
| 6.5 | 設計書生成ツール |
| 6.6 | ファイル変更監視 |
| 6.7 | エラーリカバリ・リトライ |
| 6.8 | VSIXパッケージング・マーケットプレイス公開準備 |
| 6.9 | 包括的テストスイート |

---

## 13. 設計上の重要決定まとめ

1. **Search/Replaceが主編集方式** - 全ファイル再生成より省トークン、Unified Diffより小規模モデルで安定
2. **デュアルモードTool Calling** - ネイティブFunction Calling + XMLフォールバック。バックエンド互換性を最大化
3. **近似トークンカウント** - cl100k_baseで近似し、0.8の安全率で吸収。バックエンド固有トークナイザー不要
4. **デバウンス永続化** - メモリ上で状態管理し、1秒デバウンスでディスク書き込み。ストリーミング中のI/O負荷を抑制
5. **承認がファーストクラス** - 全変更操作がApprovalServiceを経由。オート承認設定でフルオートモード、手動承認に戻すことも常に可能
