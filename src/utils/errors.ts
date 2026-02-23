/**
 * Custom error types for the extension.
 */

export class AgentError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'AgentError';
    }
}

export class AbortError extends Error {
    constructor(message = 'Operation was aborted') {
        super(message);
        this.name = 'AbortError';
    }
}

export class ToolExecutionError extends Error {
    constructor(
        public readonly toolName: string,
        message: string,
        public readonly cause?: Error,
    ) {
        super(`Tool "${toolName}" failed: ${message}`);
        this.name = 'ToolExecutionError';
    }
}

export class PathValidationError extends Error {
    constructor(
        public readonly path: string,
        public readonly reason: string,
    ) {
        super(`Path validation failed for "${path}": ${reason}`);
        this.name = 'PathValidationError';
    }
}

export class CommandBlockedError extends Error {
    constructor(
        public readonly command: string,
        public readonly reason: string,
    ) {
        super(`Command blocked: ${reason}`);
        this.name = 'CommandBlockedError';
    }
}

export class LlmConnectionError extends Error {
    constructor(
        public readonly url: string,
        message: string,
        public readonly cause?: Error,
    ) {
        super(`LLM connection to ${url} failed: ${message}`);
        this.name = 'LlmConnectionError';
    }
}

// ============================================
// Skills errors
// ============================================

export class SkillLoadError extends Error {
    constructor(
        public readonly skillName: string,
        public readonly reason: string,
    ) {
        super(`Failed to load skill "${skillName}": ${reason}`);
        this.name = 'SkillLoadError';
    }
}

export class SkillExecutionError extends Error {
    constructor(
        public readonly skillName: string,
        message: string,
        public readonly cause?: Error,
    ) {
        super(`Skill "${skillName}" execution failed: ${message}`);
        this.name = 'SkillExecutionError';
    }
}

// ============================================
// Sub-agent errors
// ============================================

export class SubAgentError extends Error {
    constructor(
        message: string,
        public readonly cause?: Error,
    ) {
        super(`SubAgent error: ${message}`);
        this.name = 'SubAgentError';
    }
}

// ============================================
// MCP errors
// ============================================

export class McpConnectionError extends Error {
    constructor(
        public readonly serverName: string,
        message: string,
        public readonly cause?: Error,
    ) {
        super(`MCP server "${serverName}" connection failed: ${message}`);
        this.name = 'McpConnectionError';
    }
}

export class McpToolError extends Error {
    constructor(
        public readonly serverName: string,
        public readonly toolName: string,
        message: string,
        public readonly cause?: Error,
    ) {
        super(`MCP tool "${serverName}/${toolName}" failed: ${message}`);
        this.name = 'McpToolError';
    }
}
