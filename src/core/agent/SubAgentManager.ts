/**
 * SubAgentManager - Spawns and manages child AgentLoop instances.
 *
 * Sub-agents run with:
 *   - Independent ConversationHistory
 *   - Optionally filtered ToolRegistry (subset of parent's tools)
 *   - Lower maxIterations (default: 10)
 *   - Events forwarded to parent's stream with [SubAgent] prefix
 */

import { AgentLoop } from './AgentLoop.js';
import { TaskState, type AgentLoopDependencies, type SimpleEventEmitter } from './types.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { ToolExecutor } from '../tools/ToolExecutor.js';
import { ToolValidator } from '../tools/ToolValidator.js';
import { ContextManager } from '../context/ContextManager.js';
import { ConversationHistory } from '../context/ConversationHistory.js';
import { SystemPrompt } from '../prompts/SystemPrompt.js';
import type { SubAgentRequest, SubAgentResult } from '../../types/skills.js';
import { SubAgentError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('SubAgentManager');

/** Default max iterations for sub-agents (lower than parent's default of 25). */
const DEFAULT_SUBAGENT_MAX_ITERATIONS = 10;

export class SubAgentManager {
    private activeSubAgents = new Set<AgentLoop>();

    /**
     * Spawn a sub-agent with the given request.
     *
     * The sub-agent uses the same LLM provider and approval service as the parent,
     * but has its own conversation history and optionally filtered tool set.
     */
    async spawn(
        request: SubAgentRequest,
        parentDeps: AgentLoopDependencies,
    ): Promise<SubAgentResult> {
        const maxIterations = request.maxIterations ?? DEFAULT_SUBAGENT_MAX_ITERATIONS;

        logger.info(`Spawning sub-agent: "${request.prompt.slice(0, 80)}..." (max ${maxIterations} iterations)`);

        try {
            // Create filtered tool registry if allowedTools specified
            const toolRegistry = this.buildToolRegistry(
                parentDeps.toolRegistry,
                request.allowedTools,
            );

            const toolValidator = new ToolValidator();
            const toolExecutor = new ToolExecutor(toolRegistry, toolValidator);

            // Build system prompt for sub-agent
            const systemPrompt = new SystemPrompt(toolRegistry);
            const systemPromptText = request.systemPromptOverride
                ?? systemPrompt.build({
                    workspaceRoot: parentDeps.workspaceRoot,
                    useXmlTools: !parentDeps.settings.preferNativeToolCalling,
                });

            // Create independent context
            const conversationHistory = new ConversationHistory();
            const contextManager = new ContextManager(parentDeps.provider, {
                modelId: parentDeps.settings.modelId,
                maxOutputTokens: parentDeps.settings.maxOutputTokens,
                contextSafetyRatio: 0.8,
                systemPrompt: systemPromptText,
            });

            // Create event emitters that forward to parent with prefix
            const onStreamChunk = this.createPrefixedStreamEmitter(parentDeps.onStreamChunk);

            const onStateChange: SimpleEventEmitter<{ state: TaskState }> = {
                fire: () => {
                    // Sub-agent state changes don't propagate to parent state
                },
            };

            const onToolCall = parentDeps.onToolCall; // Forward tool calls directly
            const onError = parentDeps.onError; // Forward errors directly

            // Create the sub-agent loop
            const subAgentLoop = new AgentLoop({
                provider: parentDeps.provider,
                toolExecutor,
                toolRegistry,
                contextManager,
                conversationHistory,
                approvalService: parentDeps.approvalService,
                workspaceRoot: parentDeps.workspaceRoot,
                settings: {
                    ...parentDeps.settings,
                    maxIterations,
                },
                onStateChange,
                onStreamChunk,
                onToolCall,
                onError,
            });

            this.activeSubAgents.add(subAgentLoop);

            // Run the sub-agent
            const resultText = await subAgentLoop.run(request.prompt);
            const iterationsUsed = subAgentLoop.getIterationCount();
            const success = subAgentLoop.getState() === TaskState.COMPLETED;

            this.activeSubAgents.delete(subAgentLoop);

            logger.info(`Sub-agent completed: success=${success}, iterations=${iterationsUsed}`);

            return {
                success,
                output: resultText || '(Sub-agent produced no output)',
                iterationsUsed,
            };
        } catch (error) {
            logger.error('Sub-agent failed', error);
            throw new SubAgentError(
                error instanceof Error ? error.message : String(error),
                error instanceof Error ? error : undefined,
            );
        }
    }

    /**
     * Cancel all active sub-agents.
     */
    cancelAll(): void {
        for (const agent of this.activeSubAgents) {
            agent.cancel();
        }
        this.activeSubAgents.clear();
    }

    /**
     * Get the number of active sub-agents.
     */
    get activeCount(): number {
        return this.activeSubAgents.size;
    }

    /**
     * Build a filtered ToolRegistry for the sub-agent.
     */
    private buildToolRegistry(
        parentRegistry: ToolRegistry,
        allowedTools?: string[],
    ): ToolRegistry {
        const subRegistry = new ToolRegistry();

        if (!allowedTools || allowedTools.length === 0) {
            // Copy all tools from parent
            subRegistry.registerAll(parentRegistry.getAll());
        } else {
            // Only register allowed tools
            const allowedSet = new Set(allowedTools.map((t) => t.toLowerCase()));
            for (const tool of parentRegistry.getAll()) {
                if (allowedSet.has(tool.name.toLowerCase())) {
                    subRegistry.register(tool);
                }
            }
        }

        return subRegistry;
    }

    /**
     * Create a stream emitter that prefixes sub-agent output.
     */
    private createPrefixedStreamEmitter(
        parentEmitter: SimpleEventEmitter<{ type: string; content: string }>,
    ): SimpleEventEmitter<{ type: string; content: string }> {
        let isFirstChunk = true;

        return {
            fire: (event) => {
                if (event.type === 'text') {
                    let content = event.content;
                    if (isFirstChunk) {
                        content = '\n[SubAgent] ' + content;
                        isFirstChunk = false;
                    }
                    parentEmitter.fire({ type: event.type, content });
                } else {
                    parentEmitter.fire(event);
                }
            },
        };
    }
}
