---
name: add-message-type
description: Add a new message type to the Extension Host <-> Webview protocol
argument-hint: "[direction: toWebview|toExtension] [message-name]"
allowed-tools: Read, Write, Edit, Glob, Grep
---

Add a new message type to the communication protocol between Extension Host and Webview.

## Arguments
- `$0` - Direction: `toWebview` (Extension→Webview) or `toExtension` (Webview→Extension)
- `$1` - Message type name in camelCase (e.g., `streamChunk`, `sendMessage`)

## Rules

1. **Read CLAUDE.md** for the message protocol convention
2. **All message types must be defined in `src/types/messages.ts`**
3. Both Extension Host and Webview must handle the new type

## Steps

1. Read `src/types/messages.ts` to understand existing types
2. Add the new message type to the appropriate union:
   - `toWebview` → add to `ExtensionToWebviewMessage`
   - `toExtension` → add to `WebviewToExtensionMessage`
3. Define any new interfaces needed for the message payload
4. If `toExtension`:
   - Add handler case in `src/webview/MessageRouter.ts`
5. If `toWebview`:
   - Add handler case in `webview-ui/src/state/store.ts` → `handleExtensionMessage`
6. Add the postMessage call at the appropriate source location
7. Report what was added and where handlers need to be implemented
