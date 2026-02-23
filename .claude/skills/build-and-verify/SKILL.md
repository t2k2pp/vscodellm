---
name: build-and-verify
description: Build the project and run tests to verify everything compiles and passes
disable-model-invocation: true
allowed-tools: Bash(npm *), Bash(node *), Read, Grep
---

Build and verify the project.

## Steps

1. **Build Extension Host**:
   ```
   cd /Users/osia/Documents/GenAIWork/VSCodeLLLM && npm run build:extension
   ```
   - Fix any TypeScript compilation errors
   - Fix any esbuild bundling errors

2. **Build Webview UI**:
   ```
   cd /Users/osia/Documents/GenAIWork/VSCodeLLLM && npm run build:webview
   ```
   - Fix any Vite/React compilation errors

3. **Run Tests**:
   ```
   cd /Users/osia/Documents/GenAIWork/VSCodeLLLM && npm run test
   ```
   - Report test results
   - Fix any failing tests

4. **Lint Check**:
   ```
   cd /Users/osia/Documents/GenAIWork/VSCodeLLLM && npm run lint 2>&1 | head -50
   ```

5. **Report Summary**:
   - Build status (pass/fail)
   - Test results (passed/failed/skipped)
   - Any remaining errors to fix
