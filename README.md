# Local LLM Agent for VS Code

ローカルLLM（Ollama, LM Studio, llama.cpp, vLLM）を活用した自律型AIコーディングアシスタント VS Code拡張機能。Cline/Claude Codeと同等の機能をローカル環境で提供します。

## 特徴

- **ローカル＆LAN対応** – クラウドAPIキー不要。ローカルマシンはもちろん、同一ネットワーク上の別マシンで動くLLMサーバーにも接続可能
- **自律型エージェント** – ファイル読み書き、コマンド実行、検索を自動で判断・実行
- **デュアルモードTool Calling** – ネイティブFunction Calling + XMLフォールバックで幅広いモデルに対応
- **承認フロー** – ファイル変更やコマンド実行は差分表示付きで事前承認
- **Markdownレンダリング** – コードブロック、ボールド、イタリックなどのリッチ表示
- **会話履歴** – 永続化された会話の管理・切り替え
- **自動コンテキスト圧縮** – トークン予算の80%到達時に自動でコンテキストを要約
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
│   ├── agent/      # AgentLoop, StreamProcessor
│   ├── context/    # ContextManager, ConversationHistory, FileContextProvider
│   ├── llm/        # LlmProvider, OpenAiCompatibleProvider, backends/
│   ├── prompts/    # SystemPrompt, テンプレート
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
npm run test          # Vitest実行（64テスト）
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
