---
name: create-backend-adapter
description: Create a new LLM backend adapter for a specific local LLM server
argument-hint: "[backend-name] [default-port]"
allowed-tools: Read, Write, Edit, Glob, Grep
---

Create a new backend adapter for a local LLM server.

## Arguments
- `$0` - Backend name (e.g., `ollama`, `lmstudio`, `llamacpp`, `vllm`)
- `$1` - Default port number (e.g., `11434`, `1234`, `8080`, `8000`)

## Rules

1. **Read CLAUDE.md** for conventions
2. **Read `src/core/llm/types.ts`** for BackendAdapter interface
3. Backend adapters only override what differs from the standard OpenAI-compatible API
4. Default base URL: `http://localhost:$1`

## Steps

1. Read `CLAUDE.md`, `src/core/llm/types.ts`, and `src/core/llm/OpenAiCompatibleProvider.ts`
2. Read an existing backend adapter to match patterns
3. Create `src/core/llm/backends/${PascalCase}Backend.ts`:
   - Implement `BackendAdapter` interface
   - Override `transformRequest()` for request quirks
   - Override `transformChunk()` for response quirks
   - Implement `listModels()` using backend-specific API if available
   - Document known limitations (tool calling support, context window behavior)
4. Create test file `src/core/llm/backends/${PascalCase}Backend.test.ts`
5. Add backend type to `ExtensionSettings.provider.backendType` union type
6. Add to `ProviderRegistry` factory logic
7. Add default URL to settings
8. Report what was created
