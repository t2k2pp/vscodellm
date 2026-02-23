---
name: implement-phase
description: Implement a specific phase from the project roadmap with full context
argument-hint: "[phase-number] [step-number]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm *), Bash(node *), Bash(mkdir *), Bash(ls *)
---

Implement a specific phase/step from the project roadmap.

## Arguments
- `$0` - Phase number (1-6)
- `$1` - Step number within the phase (e.g., 1, 2, 3...) or "all" for entire phase

## Steps

1. **Read the roadmap** from `docs/ARCHITECTURE.md` - find Phase $0, Step $1
2. **Read CLAUDE.md** for all coding conventions
3. **Read the detailed design** from `docs/ARCHITECTURE-DETAILED.md` for code snippets relevant to this step
4. **Check existing code** - read files that already exist in the target directories
5. **Identify dependencies** - ensure prerequisite modules exist
6. **Implement** the step following the design document:
   - Create files as specified in the roadmap
   - Follow the code patterns from ARCHITECTURE-DETAILED.md
   - Ensure `src/core/` files do NOT import vscode
   - Create test files alongside source files
7. **Verify** - run `npm run build` to check compilation
8. **Update TODO** - mark completed items
9. **Report** what was implemented, any deviations from design, and next steps
