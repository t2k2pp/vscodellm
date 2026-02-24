/**
 * AgentLoop - The brain of the extension.
 *
 * Manages the autonomous cycle of:
 * 1. Receive user message
 * 2. Build context (system prompt + history)
 * 3. Send to LLM (streaming)
 * 4. Parse response (text and/or tool calls)
 * 5. Execute tool calls (with approval if needed)
 * 6. Feed tool results back to LLM
 * 7. Repeat until completion or iteration limit
 *
 * Includes safeguards against silent loops:
 * - Progress notifications shown to the user during tool-only iterations
 * - Forced status report requests after consecutive tool-only iterations
 * - Work summary displayed when iteration limit is reached
 */

import type { ChatMessage, CompletionRequest, ToolCall } from '../llm/types.js';
import type { ToolContext } from '../tools/types.js';
import type { ToolExecutionResult } from '../tools/ToolExecutor.js';
import type { TranscriptLogger } from '../context/TranscriptLogger.js';
import { ToolCallAccumulator, parseXmlToolCalls, stripToolCallXml } from './StreamProcessor.js';
import {
    TaskState,
    type AgentLoopDependencies,
    type StreamChunkEvent,
} from './types.js';
import { AbortError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('AgentLoop');

/**
 * After this many consecutive tool-only iterations, insert a system message
 * asking the LLM to report its progress to the user.
 */
const STATUS_REPORT_INTERVAL = 5;

export class AgentLoop {
    private state: TaskState = TaskState.IDLE;
    private abortController: AbortController | null = null;
    private iterationCount = 0;
    private lastAssistantText = '';

    /** Track consecutive iterations where LLM returned only tool calls (no text). */
    private consecutiveToolOnlyCount = 0;

    /** Track tool calls executed across all iterations for summary. */
    private executedToolHistory: Array<{ name: string; iteration: number }> = [];

    private readonly provider;
    private readonly toolExecutor;
    private readonly toolRegistry;
    private readonly contextManager;
    private readonly conversationHistory;
    private readonly approvalService;
    private readonly workspaceRoot: string;
    private readonly maxIterations: number;
    private readonly settings;
    private readonly onStateChange;
    private readonly onStreamChunk;
    private readonly onToolCall;
    private readonly onError;
    private readonly transcriptLogger?: TranscriptLogger;
    private readonly conversationId: string;

    constructor(deps: AgentLoopDependencies) {
        this.provider = deps.provider;
        this.toolExecutor = deps.toolExecutor;
        this.toolRegistry = deps.toolRegistry;
        this.contextManager = deps.contextManager;
        this.conversationHistory = deps.conversationHistory;
        this.approvalService = deps.approvalService;
        this.workspaceRoot = deps.workspaceRoot;
        this.maxIterations = deps.settings.maxIterations || 50;
        this.settings = deps.settings;
        this.onStateChange = deps.onStateChange;
        this.onStreamChunk = deps.onStreamChunk;
        this.onToolCall = deps.onToolCall;
        this.onError = deps.onError;
        this.transcriptLogger = deps.transcriptLogger;
        this.conversationId = deps.conversationId || '';
    }

    /**
     * Run the agent loop with a user message.
     * Returns the final assistant text response (useful for sub-agents).
     */
    async run(userMessage: string): Promise<string> {
        this.abortController = new AbortController();
        this.iterationCount = 0;
        this.lastAssistantText = '';
        this.consecutiveToolOnlyCount = 0;
        this.executedToolHistory = [];

        // Log agent start
        if (this.transcriptLogger && this.conversationId) {
            this.transcriptLogger.logAgentStart(this.conversationId);
            this.transcriptLogger.logUserMessage(this.conversationId, userMessage);
        }

        // Add user message to conversation history
        this.conversationHistory.addMessage({ role: 'user', content: userMessage });

        try {
            await this.agentLoop();

            // Log agent completion
            if (this.transcriptLogger && this.conversationId) {
                this.transcriptLogger.logAgentComplete(this.conversationId, this.lastAssistantText);
            }
        } catch (error) {
            if (error instanceof AbortError || (error instanceof Error && error.name === 'AbortError')) {
                this.setState(TaskState.CANCELLED);
                logger.info('Agent loop cancelled');
            } else {
                this.onError.fire({ error: error as Error });
                this.setState(TaskState.ERROR);
                logger.error('Agent loop error', error);

                // Log agent error
                if (this.transcriptLogger && this.conversationId) {
                    this.transcriptLogger.logAgentError(
                        this.conversationId,
                        (error as Error).message || String(error),
                    );
                }
            }
        }

        return this.lastAssistantText;
    }

    /**
     * Cancel the current execution.
     */
    cancel(): void {
        this.abortController?.abort();
    }

    /**
     * Get the current state.
     */
    getState(): TaskState {
        return this.state;
    }

    /**
     * Get the number of iterations completed.
     */
    getIterationCount(): number {
        return this.iterationCount;
    }

    // ============================================
    // Main Loop
    // ============================================

    private async agentLoop(): Promise<void> {
        while (this.iterationCount < this.maxIterations) {
            this.checkAborted();
            this.iterationCount++;

            logger.info(`Iteration ${this.iterationCount}/${this.maxIterations}`);

            // --- Safeguard: progress notification for tool-only loops ---
            if (this.consecutiveToolOnlyCount >= 2) {
                this.onStreamChunk.fire({
                    type: 'text',
                    content: `\n[🔄 ステップ ${this.iterationCount}/${this.maxIterations}]\n`,
                });
            }

            // --- Safeguard: force status report after N consecutive tool-only iterations ---
            if (this.consecutiveToolOnlyCount >= STATUS_REPORT_INTERVAL) {
                logger.info(`Forcing status report after ${this.consecutiveToolOnlyCount} consecutive tool-only iterations`);
                this.conversationHistory.addMessage({
                    role: 'user',
                    content: '[System] ユーザーに現在の進捗状況を報告してください。これまでに何を行い、次に何をする予定かを簡潔に説明してから、作業を続けてください。',
                });
                this.consecutiveToolOnlyCount = 0; // Reset counter
            }

            // Step 1: Check context budget, compact if needed
            await this.contextManager.ensureBudget(this.conversationHistory);

            // Step 2: Build messages array
            const messages = this.contextManager.buildMessages(this.conversationHistory);

            // Step 3: Send to LLM (streaming)
            this.setState(TaskState.THINKING);
            const { textContent, toolCalls } = await this.streamCompletion(messages);

            // Step 4: Add assistant response to history
            if (textContent) {
                this.lastAssistantText = textContent;
                this.consecutiveToolOnlyCount = 0; // Reset: LLM produced text
            }
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: textContent || null,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            };
            this.conversationHistory.addMessage(assistantMessage);

            // Log assistant message to transcript
            if (this.transcriptLogger && this.conversationId) {
                this.transcriptLogger.logAssistantMessage(
                    this.conversationId,
                    textContent || null,
                    toolCalls.length > 0
                        ? toolCalls.map((tc) => ({
                              id: tc.id,
                              name: tc.function.name,
                              arguments: tc.function.arguments,
                          }))
                        : undefined,
                );
            }

            // Step 5: If there are tool calls, execute them
            if (toolCalls.length > 0) {
                // Track tool-only iterations
                if (!textContent) {
                    this.consecutiveToolOnlyCount++;
                }

                this.setState(TaskState.EXECUTING_TOOLS);
                const toolResults = await this.executeToolCalls(toolCalls);

                // Record executed tools for summary
                for (const result of toolResults) {
                    this.executedToolHistory.push({
                        name: result.toolName,
                        iteration: this.iterationCount,
                    });
                }

                // Add tool results to history
                for (const result of toolResults) {
                    this.conversationHistory.addMessage({
                        role: 'tool',
                        tool_call_id: result.toolCallId,
                        content: result.output,
                    });
                }

                // Check if task_complete tool was called
                if (toolResults.some((r) => r.toolName === 'task_complete')) {
                    this.setState(TaskState.COMPLETED);
                    return;
                }

                // Continue the loop - feed results back to LLM
                continue;
            }

            // Step 6: No tool calls - this is the final response
            this.setState(TaskState.COMPLETED);
            return;
        }

        // Hit iteration limit — show work summary
        this.handleMaxIterationsReached();
    }

    // ============================================
    // Max Iterations Handler
    // ============================================

    private handleMaxIterationsReached(): void {
        logger.warn(`Agent reached maximum iterations (${this.maxIterations})`);

        // Build work summary
        const summary = this.buildWorkSummary();
        this.onStreamChunk.fire({ type: 'text', content: summary });

        this.onError.fire({
            error: new Error(`最大反復回数（${this.maxIterations}回）に達しました`),
        });
        this.setState(TaskState.ERROR);
    }

    /**
     * Build a human-readable summary of work performed across all iterations.
     */
    private buildWorkSummary(): string {
        const lines: string[] = [];
        lines.push(`\n\n---`);
        lines.push(`⚠️ **最大反復回数（${this.maxIterations}回）に達しました**`);
        lines.push('');

        if (this.executedToolHistory.length > 0) {
            // Group by tool name and count
            const toolCounts = new Map<string, number>();
            for (const entry of this.executedToolHistory) {
                toolCounts.set(entry.name, (toolCounts.get(entry.name) || 0) + 1);
            }

            lines.push(`📋 **実行したツール（計 ${this.executedToolHistory.length} 回）:**`);
            for (const [name, count] of toolCounts.entries()) {
                lines.push(`  - \`${name}\`: ${count}回`);
            }
            lines.push('');
        }

        lines.push('💡 続ける場合は「続けてください」と送信してください。');
        return lines.join('\n');
    }

    // ============================================
    // Streaming Completion
    // ============================================

    private async streamCompletion(
        messages: ChatMessage[],
    ): Promise<{ textContent: string; toolCalls: ToolCall[] }> {
        let textContent = '';
        const toolCallAccumulator = new ToolCallAccumulator();

        const request = this.buildCompletionRequest(messages);

        for await (const chunk of this.provider.streamCompletion(request)) {
            this.checkAborted();

            for (const choice of chunk.choices) {
                // Accumulate text
                if (choice.delta.content) {
                    textContent += choice.delta.content;
                    this.onStreamChunk.fire({
                        type: 'text',
                        content: choice.delta.content,
                    });
                }

                // Accumulate tool call deltas
                if (choice.delta.tool_calls) {
                    for (const tc of choice.delta.tool_calls) {
                        toolCallAccumulator.addDelta(tc);
                    }
                }
            }
        }

        // If using XML fallback mode, parse tool calls from text
        let toolCalls = toolCallAccumulator.getCompleted();
        if (toolCalls.length === 0 && textContent.includes('<tool_call>')) {
            toolCalls = parseXmlToolCalls(textContent);
            // Strip tool call XML from display text
            textContent = stripToolCallXml(textContent);
        }

        return { textContent, toolCalls };
    }

    // ============================================
    // Tool Execution
    // ============================================

    private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolExecutionResult[]> {
        const context: ToolContext = {
            workspaceRoot: this.workspaceRoot,
            abortSignal: this.abortController!.signal,
            approvalService: this.approvalService,
            onProgress: (message) => {
                this.onStreamChunk.fire({ type: 'text', content: `\n[Progress: ${message}]\n` });
            },
        };

        const results: ToolExecutionResult[] = [];

        for (const toolCall of toolCalls) {
            this.checkAborted();

            // Notify UI
            this.onToolCall.fire({
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
                status: 'started',
            });

            const result = await this.toolExecutor.execute(toolCall, context);
            results.push(result);

            // Log tool execution to transcript
            if (this.transcriptLogger && this.conversationId) {
                let params: Record<string, unknown> = {};
                try {
                    params = JSON.parse(toolCall.function.arguments);
                } catch {
                    // ignore parse errors
                }
                this.transcriptLogger.logToolResult(
                    this.conversationId,
                    toolCall.id,
                    toolCall.function.name,
                    result.output,
                    result.success,
                );
            }

            // Notify UI of completion
            this.onToolCall.fire({
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
                status: result.success ? 'completed' : 'failed',
                result: result.output,
            });
        }

        return results;
    }

    // ============================================
    // Helpers
    // ============================================

    private buildCompletionRequest(messages: ChatMessage[]): CompletionRequest {
        const useNativeTools = this.settings.preferNativeToolCalling;
        const tools = useNativeTools ? this.toolRegistry.getToolDefinitions() : undefined;

        return {
            model: this.settings.modelId,
            messages,
            tools,
            tool_choice: tools ? 'auto' : undefined,
            temperature: this.settings.temperature,
            max_tokens: this.settings.maxOutputTokens,
            stream: true,
        };
    }

    private setState(state: TaskState): void {
        this.state = state;
        this.onStateChange.fire({ state });
    }

    private checkAborted(): void {
        if (this.abortController?.signal.aborted) {
            throw new AbortError('Agent loop cancelled');
        }
    }
}
