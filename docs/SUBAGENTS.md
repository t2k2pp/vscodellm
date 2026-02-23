# SubAgents & Skills 定義書

## 概要

本プロジェクトの開発を効率化するために、以下のSubAgent（専門エージェント）とSkill（再利用可能な作業手順）を定義する。
各SubAgentは独立した責務を持ち、並列実行可能な単位で設計している。

---

## SubAgents（専門エージェント）

### 1. scaffold-agent
**責務**: プロジェクト初期構造の生成
- package.json、tsconfig.json、esbuild設定、Vite設定等のボイラープレート生成
- ディレクトリ構造の作成
- ESLint/Prettier設定
- .vscode/launch.json, tasks.json

**入力**: 設計書のプロジェクト構成セクション
**出力**: ビルド可能なプロジェクトスケルトン

---

### 2. extension-host-agent
**責務**: VSCode拡張のホスト側コード実装
- extension.ts エントリポイント
- WebviewProvider
- MessageRouter
- StateManager
- コマンド登録

**入力**: モジュール依存関係図、メッセージプロトコル型定義
**出力**: 拡張ホスト側の完全な実装

---

### 3. llm-provider-agent
**責務**: LLMプロバイダー層の実装
- LlmProviderインターフェース
- OpenAiCompatibleProvider（SSEストリーミング含む）
- バックエンドアダプター（Ollama, LM Studio, llama.cpp, vLLM, Generic）
- ProviderRegistry
- TokenCounter

**入力**: OpenAI互換API仕様、各バックエンドの差異情報
**出力**: 全バックエンド対応のLLMクライアント

---

### 4. agent-loop-agent
**責務**: エージェント実行ループの実装
- AgentLoop（メインループ）
- TaskState（状態マシン）
- StreamProcessor（ストリーミング解析、ToolCallAccumulator）
- XMLツール呼び出しパーサー
- デュアルモード切替ロジック

**入力**: ツールレジストリ、LLMプロバイダー、コンテキストマネージャーのインターフェース
**出力**: 自律実行可能なエージェントコア

---

### 5. tool-system-agent
**責務**: ツールシステムの実装
- ToolRegistry, ToolExecutor, ToolValidator
- 全ツールハンドラー（ReadFile, WriteFile, EditFile, ExecuteCommand, SearchFiles, ListFiles, RunTests, AskUser, TaskComplete）
- ツール定義スキーマ（JSON Schema + XML記述）

**入力**: ツールインターフェース定義、WorkspaceService/TerminalService等のサービス層
**出力**: 9つのツール実装 + レジストリ

---

### 6. webview-ui-agent
**責務**: React WebviewのUI実装
- チャットUI（ChatView, MessageList, InputArea, StreamingMessage）
- 設定画面（SettingsView, ProviderConfig, ModelSelector）
- 会話履歴画面（HistoryView）
- 承認ダイアログ（ApprovalDialog）
- Zustand store
- VSCode APIブリッジ
- CSSスタイル（VSCode CSS変数使用）

**入力**: メッセージプロトコル型定義、UI設計仕様
**出力**: 完全なWebview UIアプリケーション

---

### 7. diff-system-agent
**責務**: 差分システムの実装
- DiffGenerator（unified diff生成）
- DiffApplier（差分適用）
- DiffPreview（VSCode diff editor連携）
- SearchReplace（Search/Replaceブロック処理）

**入力**: エディタサービス、ワークスペースサービス
**出力**: コード変更の生成・プレビュー・適用パイプライン

---

### 8. context-manager-agent
**責務**: コンテキスト管理システムの実装
- ContextManager（トークン予算計算）
- ContextCompactor（自動圧縮）
- FileContextProvider（ファイルキャッシュ・重複排除）
- ConversationHistory（会話履歴管理）
- SystemPrompt（テンプレートベースのプロンプト構築）

**入力**: TokenCounter、LLMプロバイダー
**出力**: コンテキストウィンドウを効率的に管理する仕組み

---

### 9. security-agent
**責務**: セキュリティ層の実装
- ApprovalService（承認フロー）
- PathValidator（パストラバーサル防止）
- CommandSanitizer（危険コマンドブロック）
- IgnoreService（.localllmignore + .gitignore）

**入力**: 設定スキーマ、セキュリティ要件
**出力**: 安全なツール実行を保証するセキュリティ層

---

### 10. services-agent
**責務**: VSCode APIラッパーサービスの実装
- WorkspaceService（ファイル操作、workspace.fs）
- GlobSearch（ファイル検索）
- TerminalService（ターミナル作成・コマンド実行・出力キャプチャ）
- ShellIntegration（シェル統合）
- EditorService（エディタ操作）
- DocumentTracker（開いているドキュメント追跡）
- FileWatcher（ファイル変更監視）

**入力**: VSCode API仕様
**出力**: クロスプラットフォーム対応のサービス群

---

### 11. test-agent
**責務**: テストインフラとテスト実装
- Vitest設定
- VSCode APIモック
- LLM APIモック
- 各モジュールのユニットテスト
- 統合テスト

**入力**: 全モジュールの実装
**出力**: テストスイート + CI設定

---

## Skills（再利用可能な作業手順）

### Skill 1: `create-module`
**用途**: 新しいモジュール（クラス/インターフェース）をテンプレートから作成
**手順**:
1. src/配下の適切なディレクトリにTypeScriptファイルを作成
2. インターフェースまたはクラスの雛形を生成
3. 必要な型インポートを追加
4. 対応するテストファイルを隣に作成
5. index.tsがあればre-exportを追加

### Skill 2: `create-tool-handler`
**用途**: 新しいツールハンドラーを作成してレジストリに登録
**手順**:
1. src/core/tools/handlers/ にToolインターフェース実装を作成
2. パラメータのJSON Schemaを定義
3. XML記述用のdescriptionを作成
4. ToolRegistryへの登録コードを追加
5. テストを作成

### Skill 3: `create-webview-component`
**用途**: 新しいReactコンポーネントを作成
**手順**:
1. webview-ui/src/components/ 配下に.tsxファイルを作成
2. 必要なhooksとstoreインポートを追加
3. VSCode CSS変数を使ったスタイリング
4. 親コンポーネントへの組み込み

### Skill 4: `create-backend-adapter`
**用途**: 新しいLLMバックエンドアダプターを作成
**手順**:
1. src/core/llm/backends/ にBackendAdapter実装を作成
2. transformRequest/transformChunk/listModelsをオーバーライド
3. ProviderRegistryに登録
4. 設定UIのバックエンドタイプ選択肢に追加
5. テストを作成

### Skill 5: `add-message-type`
**用途**: 新しいメッセージタイプをプロトコルに追加
**手順**:
1. src/types/messages.ts に新しいメッセージ型を追加
2. MessageRouterにハンドラーを追加
3. Zustand storeにハンドラーを追加
4. 必要に応じてWebviewコンポーネントを更新

### Skill 6: `build-and-verify`
**用途**: ビルドして動作確認
**手順**:
1. `npm run build` で拡張機能とWebviewをビルド
2. TypeScriptコンパイルエラーの確認と修正
3. `npm run test` でテスト実行
4. ESLintチェック

---

## SubAgent実行の並列化戦略

以下の依存関係に基づき、可能な限りSubAgentを並列に起動する:

### 並列実行グループ1（基盤 - 依存なし）
- **scaffold-agent**: プロジェクト構造
- **型定義作成**: messages.ts, settings.ts, 各types.ts

### 並列実行グループ2（コアモジュール - 型定義に依存）
- **llm-provider-agent**: LLMクライアント
- **services-agent**: VSCode APIラッパー
- **security-agent**: セキュリティ層

### 並列実行グループ3（ビジネスロジック - コアモジュールに依存）
- **tool-system-agent**: ツールシステム
- **context-manager-agent**: コンテキスト管理
- **diff-system-agent**: 差分システム

### 並列実行グループ4（統合 - 全コアに依存）
- **agent-loop-agent**: エージェントループ
- **webview-ui-agent**: UI

### 並列実行グループ5（結合 - 全モジュールに依存）
- **extension-host-agent**: エントリポイント統合
- **test-agent**: テスト

---

## SubAgent間の共有インターフェース

全SubAgentが参照する共通型定義:

```
src/types/
├── messages.ts    ← 全SubAgentが参照
├── settings.ts    ← extension-host, webview-ui, security が参照
├── index.ts       ← re-exports

src/core/llm/types.ts      ← llm-provider, agent-loop, context-manager が参照
src/core/tools/types.ts     ← tool-system, agent-loop が参照
src/core/context/types.ts   ← context-manager, agent-loop が参照
src/core/diff/types.ts      ← diff-system, tool-system が参照
```

これらの型定義ファイルを最初に作成することで、SubAgent間の整合性を保証する。
