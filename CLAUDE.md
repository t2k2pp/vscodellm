# CLAUDE.md - Local LLM Agent 開発ガイド

## プロジェクト概要
ローカルLLM（Ollama, LM Studio, llama.cpp, vLLM）を活用したVSCode拡張機能。
自律型AIコーディングアシスタントで、Cline/Claude Codeと同等の機能をローカルで提供する。

## 重要な設計原則

### アーキテクチャ
- **2つの独立したビルドターゲット**: `src/`はesbuild→Node.js、`webview-ui/`はVite→ブラウザ
- **`src/core/`はVSCode API非依存**: `import vscode` は`src/core/`内で絶対に使わない。VSCode APIへのアクセスは全て`src/services/`経由
- **型定義のみ共有**: Extension HostとWebview UIは`src/types/`の型定義のみ共有する

### LLMプロバイダー
- 全バックエンドはOpenAI互換APIで接続
- **デュアルモードTool Calling**: ネイティブFunction Calling + XMLフォールバック
- Ollamaデフォルト: `http://localhost:11434`, LM Studio: `http://localhost:1234`, llama.cpp: `http://localhost:8080`, vLLM: `http://localhost:8000`
- ローカルサーバーはAPIキー不要（空文字 or 'not-needed'）

### エージェント
- maxIterationsデフォルト: 25
- temperature: 0.0（コーディングは決定論的）
- コンテキスト安全率: 0.8（予算の80%でauto-compact発動）
- トークンカウントはgpt-tokenizer(cl100k_base)で近似

### セキュリティ
- **パストラバーサル禁止**: ワークスペース外のファイルアクセスをブロック
- **デフォルトブロック**: `.env`, `*credential*`, `*secret*`, `*.pem`, `*.key`, `.git/`, `node_modules/`
- **危険コマンドブロック**: `rm -rf /`, `mkfs`, `dd if=`, `curl | sh`, `chmod 777`
- 変更操作（write/edit/command）は必ずApprovalServiceを経由

## ディレクトリ構成ルール

```
src/core/              → ビジネスロジック（VSCode非依存、ユニットテスト可能）
  ├── agent/           → AgentLoop, SubAgentManager, StreamProcessor
  ├── context/         → ContextManager, ConversationHistory, TranscriptLogger, TranscriptSearcher
  ├── llm/             → LlmProvider, OpenAiCompatibleProvider, backends/
  ├── tools/           → ToolRegistry, ToolExecutor, handlers/
  ├── prompts/         → SystemPrompt, RulesLoader, templates/
  ├── skills/          → SkillLoader, SkillRegistry, SkillExecutor
  ├── mcp/             → McpClient, McpServerManager, McpToolAdapter
  └── diff/            → DiffGenerator, DiffApplier
src/services/          → VSCode APIラッパー
src/webview/           → WebviewViewProvider（ホスト側）
src/state/             → 状態管理（StateManager, Settings, ConversationStore）
src/security/          → セキュリティ（Approval, PathValidator, CommandSanitizer）
src/types/             → 共有型定義（messages, skills, transcript）
src/utils/             → ユーティリティ
webview-ui/            → React Webviewアプリケーション（別ビルド）
test/                  → テスト基盤
docs/                  → 設計書
```

## 技術スタック

| 項目 | 選定 |
|------|------|
| 言語 | TypeScript 5.3+ |
| Extension Host | esbuild (CJS, Node.js, external: vscode) |
| Webview UI | Vite + React 18 + Zustand |
| テスト | Vitest |
| Lint | ESLint |
| Format | Prettier |
| 差分生成 | diff (npm) |
| トークンカウント | gpt-tokenizer |
| Ignore処理 | ignore (npm) |
| パッケージング | vsce |

## コーディング規約

- テストファイルはソースの隣に配置: `AgentLoop.ts` → `AgentLoop.test.ts`
- インターフェースはI接頭辞を使わない: `LlmProvider`（`ILlmProvider`ではない）
- エラーは`src/utils/errors.ts`のカスタムエラークラスを使う
- EventEmitterパターンでUI更新を通知（onStateChange, onStreamChunk, onToolCall, onError）
- 非同期処理はasync/awaitを使い、Promiseチェーンは避ける
- ファイルパスは`src/utils/platform.ts`のヘルパーでクロスプラットフォーム対応

## メッセージプロトコル

Extension Host ↔ Webview間のメッセージは全て`src/types/messages.ts`で型定義する。
新しいメッセージタイプを追加する場合:
1. `messages.ts`に型を追加
2. `MessageRouter.ts`にハンドラーを追加
3. Zustand storeの`handleExtensionMessage`にcaseを追加

## ビルドコマンド

```bash
npm run build              # 全体ビルド
npm run build:extension    # Extension Hostのみ
npm run build:webview      # Webview UIのみ
npm run dev                # 開発モード（watch）
npm run test               # テスト実行
npm run package            # VSIXパッケージ作成
```

## 実装フェーズ

実装済み: Phase 1〜6（基盤・エージェント・編集・ターミナル・コンテキスト・品質向上）

追加実装済み:
- Skills（SKILL.mdベースの再利用可能手順）
- Sub-agents（子AgentLoopによるタスク分割）
- MCP（Model Context Protocol）クライアント
- プロジェクトルールファイル読み込み（`.localllm/rules.md`等）
- 会話トランスクリプト（JSONL保存 + 検索による忘却対策）

## カスタムスキル（.claude/skills/）

開発効率化のためのカスタムスラッシュコマンド:

| コマンド | 用途 |
|---------|------|
| `/create-module [path] [class\|interface]` | TypeScriptモジュール + テストファイル作成 |
| `/create-tool-handler [name] [description]` | ツールハンドラー作成 + レジストリ登録 |
| `/create-webview-component [path] [page\|widget\|common]` | Reactコンポーネント作成 |
| `/create-backend-adapter [name] [port]` | LLMバックエンドアダプター作成 |
| `/add-message-type [toWebview\|toExtension] [name]` | メッセージプロトコル型追加 |
| `/build-and-verify` | ビルド + テスト + Lint実行 |
| `/implement-phase [phase] [step]` | ロードマップの特定ステップを実装 |
| `/review-architecture` | 設計対比の実装状況レポート |

## 設計書リファレンス

- `docs/ARCHITECTURE.md` - 日本語設計書（全体像）
- `docs/ARCHITECTURE-DETAILED.md` - 詳細設計書（コードスニペット含む）
- `docs/SUBAGENTS.md` - SubAgent/Skill定義（レガシー、スキルに移行済み）
