# Local LLM Agent for VS Code

ローカルLLM（Ollama, LM Studio, llama.cpp, vLLM）を活用した自律型AIコーディングアシスタント VS Code拡張機能。Cline/Claude Codeと同等の機能をローカル環境で提供します。

## 特徴

- **ローカル＆LAN対応** – クラウドAPIキー不要。ローカルマシンはもちろん、同一ネットワーク上の別マシンで動くLLMサーバーにも接続可能
- **自律型エージェント** – ファイル読み書き、コマンド実行、検索を自動で判断・実行
- **Skills対応** – SKILL.mdベースの再利用可能な手順を定義し、エージェントが自律的に呼び出し
- **Sub-agents** – 複雑なタスクを子エージェントに分割して並行処理
- **MCP (Model Context Protocol)** – 外部MCPサーバーのツールを動的に取り込み
- **デュアルモードTool Calling** – ネイティブFunction Calling + XMLフォールバックで幅広いモデルに対応
- **承認フロー** – ファイル変更やコマンド実行は差分表示付きで事前承認
- **Markdownレンダリング** – コードブロック、ボールド、イタリックなどのリッチ表示
- **会話履歴** – 永続化された会話の管理・切り替え
- **自動コンテキスト圧縮** – トークン予算の80%到達時に自動でコンテキストを要約
- **会話トランスクリプト** – 全会話をJSONLファイルに保存。圧縮で失われた詳細を検索で回復可能
- **トークン使用量表示** – リアルタイムのコンテキスト消費率を可視化

## 対応バックエンド

| バックエンド | デフォルトURL | 状態 |
|------------|-------------|------|
| **Ollama** | `http://localhost:11434` | ネイティブAPI対応 |
| **LM Studio** | `http://localhost:1234` | OpenAI互換 |
| **llama.cpp** | `http://localhost:8080` | OpenAI互換 |
| **vLLM** | `http://localhost:8000` | OpenAI互換 |
| **Generic** | 任意 | OpenAI互換サーバー全般 |

## インストール

### VSIXからインストール

```bash
# ビルド済みVSIXを使う場合
code --install-extension local-llm-agent-0.1.0.vsix
```

または VS Code 内で `Cmd+Shift+P` → `Extensions: Install from VSIX...` から選択。

### ソースからビルド

```bash
git clone https://github.com/t2k2pp/vscodellm.git
cd vscodellm
npm install
cd webview-ui && npm install && cd ..
npm run build
npm run package    # → local-llm-agent-0.1.0.vsix を生成
```

## クイックスタート

1. Ollamaをインストールし、モデルをダウンロード:
   ```bash
   ollama pull llama3.2
   ```

2. VS Codeのサイドバーに表示される **Local LLM Agent** アイコンをクリック

3. **Settings** タブでバックエンドURLとモデルを設定
   - ローカルの場合: `http://localhost:11434`
   - LAN上の別マシンの場合: `http://192.168.x.x:11434`

4. **Chat** タブでメッセージを入力して対話開始

## 利用可能なツール

エージェントは以下のツールを自律的に使用します:

| ツール | 説明 |
|--------|------|
| `read_file` | ファイルの内容を読み取り |
| `write_file` | ファイルを新規作成（承認必要） |
| `edit_file` | 既存ファイルをsearch/replaceで編集（承認必要） |
| `execute_command` | ターミナルコマンドを実行（承認必要） |
| `search_files` | ワークスペース内をregex検索 |
| `list_files` | ディレクトリ内のファイル一覧 |
| `ask_user` | ユーザーに質問 |
| `task_complete` | タスク完了を報告 |
| `invoke_skill` | 登録済みスキルを呼び出し |
| `spawn_subagent` | 子エージェントを生成してサブタスクを実行（承認必要） |
| `search_conversation_history` | 過去の会話トランスクリプトを検索（コンテキスト圧縮後の詳細回復用） |
| MCP動的ツール | MCPサーバーから取得したツール（承認必要） |

## プロジェクトルール

ワークスペースにルールファイルを配置すると、エージェントが自動でシステムプロンプトに取り込みます。プロジェクト固有のコーディング規約、アーキテクチャルール、禁止事項などを定義できます。

### 対応ファイル（優先順）

| ファイル | 説明 |
|---------|------|
| `.localllm/rules.md` | **推奨** – 本拡張固有のルールファイル |
| `CLAUDE.md` | Claude Code互換 |
| `.clinerules` | Cline互換 |
| `.cursorrules` | Cursor互換 |
| `.github/copilot-instructions.md` | GitHub Copilot互換 |

- 複数のファイルが存在する場合、すべて読み込まれます（上記順序で連結）
- 最大64KBまで読み込み（超過分は切り捨て）
- ルールファイルの内容はシステムプロンプト内で「プロジェクトルール」として明示され、エージェントの一般ルールより優先されます

### 使用例: `.localllm/rules.md`

```markdown
# プロジェクトルール

## コーディング規約
- TypeScriptを使用する
- テストファイルはソースの隣に配置（例: Foo.ts → Foo.test.ts）
- インターフェースにI接頭辞を使わない

## アーキテクチャ
- src/core/ は VSCode API 非依存にする
- 非同期処理は async/await を使用

## 禁止事項
- console.log を本番コードに残さない
- any 型を使わない
```

## Skills（スキル）

SKILL.mdファイルでカスタム手順を定義し、エージェントが自律的に呼び出せます。

### スキルの配置場所

- `.localllm/skills/<スキル名>/SKILL.md` – プロジェクト固有
- `.claude/skills/<スキル名>/SKILL.md` – Claude Code互換

### SKILL.mdフォーマット

```markdown
---
name: create-module
description: TypeScriptモジュールとテストファイルを作成
argument-hint: "[module-path] [type: class|interface]"
allowed-tools: Read, Write, Glob, Grep
---

## Steps
1. Read `CLAUDE.md` for conventions
2. Create `$0.ts` with class/interface skeleton
3. Create `$0.test.ts` with test template
```

- `$0`, `$1` はユーザー引数で自動展開
- `allowed-tools` でスキル実行時に使用可能なツールを制限可能
- ワークスペース内のスキルファイルを変更すると自動リロード

## Sub-agents（子エージェント）

複雑なタスクを子エージェントに分割できます。子エージェントは独立した会話コンテキストで動作し、完了時に結果を親に返します。

- デフォルト最大イテレーション: 10（親の25より少ない）
- ツールセットをフィルタ可能（読み取り専用サブタスク等）
- 承認が必要（`spawn_subagent`ツール使用時）

## MCP（Model Context Protocol）

外部MCPサーバーのツールを動的に追加できます。

### 設定ファイル: `.localllm/mcp.json`

```json
{
  "servers": [
    {
      "name": "my-mcp-server",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  ]
}
```

- MCPサーバーは拡張機能起動時に自動で起動
- ツール名は `サーバー名__ツール名` 形式で名前衝突を回避
- 全MCPツールは承認必須（外部サーバーのため）
- 現在対応: stdio トランスポート（SSEは今後対応）

## 会話トランスクリプト

エージェントの全会話（ユーザーメッセージ、アシスタント応答、ツール呼び出し・結果）がJSONLファイルとして自動的に保存されます。

### 保存場所

```
.localllm/transcripts/{conversationId}.jsonl
```

### 仕組み

- 会話ごとに1つのJSONLファイルが作成され、各イベントが1行のJSONとして逐次追記
- コンテキスト圧縮（auto-compact）が発動しても、元の詳細はトランスクリプトに残存
- エージェントは `search_conversation_history` ツールで過去の会話を自動検索可能
- 圧縮後のsummaryに「詳細が必要な場合はトランスクリプトを検索可能」と注記が追加される

### 記録されるイベント

| タイプ | 説明 |
|--------|------|
| `agent_start` | エージェント実行開始 |
| `user_message` | ユーザーメッセージ |
| `assistant_message` | アシスタント応答（テキスト + ツール呼び出し） |
| `tool_result` | ツール実行結果 |
| `context_compacted` | コンテキスト圧縮のsummary |
| `agent_complete` | エージェント実行完了 |
| `agent_error` | エージェントエラー |

### 注意事項

- トランスクリプトにはコード内容やコマンド出力が含まれる場合があります
- `.gitignore` に `.localllm/transcripts/` を追加することを推奨します

## コンテキストメニュー

エディタでコードを選択して右クリック:

- **Explain Selected Code** – 選択したコードの説明をエージェントに依頼
- **Refactor Selected Code** – 選択したコードのリファクタリングを依頼

## セキュリティ

- ワークスペース外のファイルアクセスをブロック（パストラバーサル防止）
- `.env`, `*.pem`, `*.key` などの機密ファイルをデフォルトブロック
- `rm -rf /`, `mkfs`, `curl | sh` などの危険コマンドを自動ブロック
- `.localllmignore` / `.gitignore` によるファイルアクセス制御

## プロジェクト構成

```
src/
├── core/           # ビジネスロジック（VSCode API非依存）
│   ├── agent/      # AgentLoop, StreamProcessor, SubAgentManager
│   ├── context/    # ContextManager, ConversationHistory, TranscriptLogger, TranscriptSearcher
│   ├── llm/        # LlmProvider, OpenAiCompatibleProvider, backends/
│   ├── mcp/        # McpClient, McpTransport, McpToolAdapter, McpServerManager
│   ├── prompts/    # SystemPrompt, RulesLoader, テンプレート
│   ├── skills/     # SkillLoader, SkillRegistry, SkillExecutor
│   └── tools/      # ToolRegistry, ToolExecutor, handlers/
├── security/       # ApprovalService, PathValidator, CommandSanitizer
├── services/       # VSCode APIラッパー（workspace, terminal, editor, ignore）
├── state/          # StateManager（シングルトン、永続化）
├── types/          # 共有型定義・メッセージプロトコル
├── utils/          # errors, logger, platform, async（retry含む）
└── webview/        # WebviewProvider, MessageRouter

webview-ui/src/
├── components/
│   ├── chat/       # ChatView, MessageBubble, ToolCallDisplay, TokenUsage
│   ├── common/     # Markdown, CodeBlock, Spinner
│   ├── approval/   # ApprovalDialog + DiffView
│   ├── diff/       # DiffView（unified diff表示）
│   ├── history/    # HistoryView, HistoryItem
│   └── settings/   # SettingsView, ProviderConfig, ModelSelector
├── hooks/          # useMessages, useExtensionState
├── state/          # Zustand store, types
└── styles/         # global.css, chat.css, components.css, settings.css
```

## 開発

```bash
npm run dev           # watch モード（Extension + Webview）
npm run test          # Vitest実行（195テスト）
npm run build         # プロダクションビルド
npm run lint          # ESLint
npm run package       # VSIXパッケージ生成
```

## 技術スタック

| 項目 | 選定 |
|------|------|
| 言語 | TypeScript 5.3+ |
| Extension Host | esbuild (CJS, Node.js) |
| Webview UI | Vite + React 18 + Zustand |
| テスト | Vitest |
| 差分生成 | diff (npm) |
| トークンカウント | gpt-tokenizer (cl100k_base) |
| Ignore処理 | ignore (npm) |

## ライセンス

MIT
