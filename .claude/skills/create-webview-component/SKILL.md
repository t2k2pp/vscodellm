---
name: create-webview-component
description: Create a new React component for the webview UI using VS Code styling
argument-hint: "[component-path] [component-type: page|widget|common]"
allowed-tools: Read, Write, Edit, Glob, Grep
---

Create a new React component for the webview UI.

## Arguments
- `$0` - Component path relative to webview-ui/src/components/ (e.g., `chat/MessageBubble`)
- `$1` - Component type: `page` (full view), `widget` (embedded), `common` (reusable)

## Rules

1. **Read CLAUDE.md** for conventions
2. **Use VS Code CSS variables** for theming (--vscode-editor-background, --vscode-editor-foreground, etc.)
3. **Use @vscode/codicons** for icons
4. **Use Zustand store** from `webview-ui/src/state/store.ts` for state
5. **No external CSS frameworks** - use plain CSS with VS Code variables

## Steps

1. Read `CLAUDE.md` and check existing components in `webview-ui/src/components/`
2. Create `webview-ui/src/components/$0.tsx`:
   - Functional component with proper TypeScript props interface
   - Use VS Code CSS variables for styling
   - Import from Zustand store if state is needed
   - Use `useMessages` hook for extension communication
3. Create corresponding CSS file if needed (e.g., `$0.css` or add to existing category CSS)
4. If component type is `page`, integrate into `App.tsx` navigation
5. If component type is `widget`, document where it should be embedded
6. Report what was created
