---
name: create-tool-handler
description: Create a new tool handler implementing the Tool interface and register it
argument-hint: "[tool-name] [description]"
allowed-tools: Read, Write, Edit, Glob, Grep
---

Create a new tool handler for the agent's tool system.

## Arguments
- `$0` - Tool name in snake_case (e.g., `read_file`, `execute_command`)
- `$1` - Short description of what the tool does

## Rules

1. **Read CLAUDE.md** for conventions
2. **Read `src/core/tools/types.ts`** for the Tool interface
3. **Follow existing handler patterns** in `src/core/tools/handlers/`
4. Tool names use snake_case, class names use PascalCase + "Tool" suffix

## Steps

1. Read `CLAUDE.md` and `src/core/tools/types.ts`
2. Read an existing handler in `src/core/tools/handlers/` to match patterns
3. Create `src/core/tools/handlers/${PascalCase}Tool.ts`:
   - Implement `Tool` interface
   - Define `name`, `description`, `parameterSchema` (JSON Schema), `requiresApproval`
   - Implement `execute()` method with proper error handling
   - Add security checks (IgnoreService for file tools, CommandSanitizer for command tools)
4. Create test file `src/core/tools/handlers/${PascalCase}Tool.test.ts`
5. Register in `src/core/tools/ToolRegistry.ts` or relevant setup code
6. Add XML description to `src/core/prompts/ToolPrompts.ts` for XML fallback mode
7. Update `src/core/tools/definitions.ts` if it exists
8. Report what was created and any manual integration steps needed
