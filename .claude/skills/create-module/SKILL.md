---
name: create-module
description: Create a new TypeScript module with interface/class skeleton and test file
argument-hint: "[module-path] [type: class|interface]"
allowed-tools: Read, Write, Glob, Grep
---

Create a new TypeScript module at the specified path.

## Arguments
- `$0` - Module path relative to project root (e.g., `src/core/agent/AgentLoop`)
- `$1` - Type: `class` or `interface` (default: `class`)

## Rules

1. **Check CLAUDE.md** for coding conventions before generating code
2. **src/core/ modules must NOT import vscode** - use service layer abstractions instead
3. **Follow existing patterns** - read nearby files to match style

## Steps

1. Read `CLAUDE.md` for project conventions
2. Check if the file already exists at `$0.ts` - if so, warn and stop
3. Determine the module name from the path (e.g., `AgentLoop` from `src/core/agent/AgentLoop`)
4. Create `$0.ts` with:
   - Appropriate imports based on the directory (check `types.ts` in same directory)
   - Export the class or interface with JSDoc description
   - Constructor with dependency injection pattern for classes
   - Dispose method if the class manages resources
5. Create `$0.test.ts` alongside with:
   - Import from vitest (`describe`, `it`, `expect`, `vi`)
   - Basic test suite structure with describe block
   - At least one placeholder test
6. If an `index.ts` exists in the same directory, add re-export
7. Report what was created
