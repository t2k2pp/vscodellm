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
 */

import type { ChatMessage, CompletionRequest, ToolCall } from '../llm/types.js';
import type { ToolContext } from '../tools/types.js';
import type { ToolExecutionResult } from '../tools/ToolExecutor.js';
import { ToolCallAccumulator, parseXmlToolCalls, stripToolCallXml } from './StreamProcessor.js';
import {
    TaskState,
    type AgentLoopDependencies,
    type StreamChunkEvent,
} from './types.js';
import { AbortError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('AgentLoop');

export class AgentLoop {
    private state: TaskState = TaskState.IDLE;
    private abortController: AbortController | null = null;
    private iterationCount = 0;

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

    constructor(deps: AgentLoopDependencies) {
        this.provider = deps.provider;
        this.toolExecutor = deps.toolExecutor;
        this.toolRegistry = deps.toolRegistry;
        this.contextManager = deps.contextManager;
        this.conversationHistory = deps.conversationHistory;
        this.approvalService = deps.approvalService;
        this.workspaceRoot = deps.workspaceRoot;
        this.maxIterations = deps.settings.maxIterations || 25;
        this.settings = deps.settings;
        this.onStateChange = deps.onStateChange;
        this.onStreamChunk = deps.onStreamChunk;
        this.onToolCall = deps.onToolCall;
        this.onError = deps.onError;
    }

    /**
     * Run the agent loop with a user message.
     */
    async run(userMessage: string): Promise<void> {
        this.abortController = new AbortController();
        this.iterationCount = 0;

        // Add user message to conversation history
        this.conversationHistory.addMessage({ role: 'user', content: userMessage });

        try {
            await this.agentLoop();
        } catch (error) {
            if (error instanceof AbortError || (error instanceof Error && error.name === 'AbortError')) {
                this.setState(TaskState.CANCELLED);
                logger.info('Agent loop cancelled');
            } else {
                this.onError.fire({ error: error as Error });
                this.setState(TaskState.ERROR);
                logger.error('Agent loop error', error);
            }
        }
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

    // ============================================
    // Main Loop
    // ============================================

    private async agentLoop(): Promise<void> {
        while (this.iterationCount < this.maxIterations) {
            this.checkAborted();
            this.iterationCount++;

            logger.info(`Iteration ${this.iterationCount}/${this.maxIterations}`);

            // Step 1: Check context budget, compact if needed
            await this.contextManager.ensureBudget(this.conversationHistory);

            // Step 2: Build messages array
            const messages = this.contextManager.buildMessages(this.conversationHistory);

            // Step 3: Send to LLM (streaming)
            this.setState(TaskState.THINKING);
            const { textContent, toolCalls } = await this.streamCompletion(messages);

            // Step 4: Add assistant response to history
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: textContent || null,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            };
            this.conversationHistory.addMessage(assistantMessage);

            // Step 5: If there are tool calls, execute them
            if (toolCalls.length > 0) {
                this.setState(TaskState.EXECUTING_TOOLS);
                const toolResults = await this.executeToolCalls(toolCalls);

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

        // Hit iteration limit
        logger.warn(`Agent reached maximum iterations (${this.maxIterations})`);
        this.onError.fire({
            error: new Error(`Agent reached maximum iterations (${this.maxIterations})`),
        });
        this.setState(TaskState.COMPLETED);
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
