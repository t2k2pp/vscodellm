---
name: review-architecture
description: Review current implementation against the architecture design and report gaps
disable-model-invocation: true
allowed-tools: Read, Glob, Grep
---

Review the current implementation state against the architecture design.

## Steps

1. **Read the design documents**:
   - `docs/ARCHITECTURE.md`
   - `docs/ARCHITECTURE-DETAILED.md`
   - `CLAUDE.md`

2. **Scan the project structure**:
   - List all `.ts` and `.tsx` files under `src/` and `webview-ui/src/`
   - Compare against the expected structure in the design

3. **Check implementation completeness** for each module:
   - Does the file exist?
   - Does it export the expected interface/class?
   - Are the key methods implemented (not just stubs)?
   - Does a test file exist?

4. **Report** in this format:

   ```
   ## Implementation Status

   ### Phase 1: Foundation
   - [x] 1.1 Project scaffold - COMPLETE
   - [x] 1.2 Extension entry point - COMPLETE
   - [ ] 1.3 React webview - PARTIAL (missing InputArea)
   - [ ] 1.4 Message protocol - NOT STARTED

   ### Gaps & Issues
   - Missing: src/core/agent/AgentLoop.ts
   - Stub only: src/core/llm/TokenCounter.ts (empty methods)
   - No tests: src/webview/MessageRouter.ts

   ### Next Steps
   1. Complete Phase 1.3 - implement InputArea component
   2. ...
   ```
