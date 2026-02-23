/**
 * Agent-specific type definitions.
 */

import type { LlmProvider } from '../llm/LlmProvider.js';
import type { ToolExecutor } from '../tools/ToolExecutor.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { ContextManager } from '../context/ContextManager.js';
import type { ConversationHistory } from '../context/ConversationHistory.js';
import type { TranscriptLogger } from '../context/TranscriptLogger.js';
import type { ApprovalService } from '../../security/ApprovalService.js';

/** Task states for the agent state machine. */
export enum TaskState {
    IDLE = 'idle',
    THINKING = 'thinking',
    EXECUTING_TOOLS = 'executing_tools',
    WAITING_APPROVAL = 'waiting_approval',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    ERROR = 'error',
}

/** Event emitter interface (compatible with both vscode.EventEmitter and simple emitters). */
export interface SimpleEventEmitter<T> {
    fire(data: T): void;
}

/** Events fired by the agent loop. */
export interface AgentStateEvent {
    state: TaskState;
}

export interface StreamChunkEvent {
    type: 'text' | 'tool_call';
    content: string;
}

export interface ToolCallEvent {
    id: string;
    name: string;
    arguments: string;
    status: 'started' | 'completed' | 'failed';
    result?: string;
}

export interface AgentErrorEvent {
    error: Error;
}

/** Dependencies injected into AgentLoop. */
export interface AgentLoopDependencies {
    provider: LlmProvider;
    toolExecutor: ToolExecutor;
    toolRegistry: ToolRegistry;
    contextManager: ContextManager;
    conversationHistory: ConversationHistory;
    approvalService: ApprovalService;
    workspaceRoot: string;
    /** Optional: JSONL transcript logger for persistent conversation logging. */
    transcriptLogger?: TranscriptLogger;
    /** Optional: Conversation ID for transcript logging. */
    conversationId?: string;
    settings: {
        maxIterations: number;
        temperature: number;
        maxOutputTokens: number;
        modelId: string;
        preferNativeToolCalling: boolean;
    };
    onStateChange: SimpleEventEmitter<AgentStateEvent>;
    onStreamChunk: SimpleEventEmitter<StreamChunkEvent>;
    onToolCall: SimpleEventEmitter<ToolCallEvent>;
    onError: SimpleEventEmitter<AgentErrorEvent>;
}
