/**
 * Tool system type definitions.
 * All tool handlers implement the Tool interface.
 */

import type { ApprovalService } from '../../security/ApprovalService.js';

/** Context passed to every tool execution. */
export interface ToolContext {
    workspaceRoot: string;
    abortSignal: AbortSignal;
    approvalService: ApprovalService;
    onProgress: (message: string) => void;
}

/** Result returned by every tool execution. */
export interface ToolResult {
    success: boolean;
    output: string;
    metadata?: Record<string, unknown>;
}

/** Tool interface that all tool handlers implement. */
export interface Tool {
    /** Unique tool name used in function calling (e.g. 'read_file'). */
    readonly name: string;

    /** Human-readable description for the LLM. */
    readonly description: string;

    /** JSON Schema for the tool's parameters. */
    readonly parameterSchema: Record<string, unknown>;

    /** Whether this tool requires user approval before execution. */
    readonly requiresApproval: boolean;

    /** Execute the tool with the given parameters. */
    execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

/** Validation result from ToolValidator. */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
