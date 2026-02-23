/**
 * Type definitions for Skills, Sub-agents, and MCP.
 */

// ============================================
// Skills
// ============================================

/** A skill definition loaded from a SKILL.md file. */
export interface SkillDefinition {
    /** Unique skill name (from YAML frontmatter). */
    name: string;
    /** Human-readable description. */
    description: string;
    /** Hint for arguments (e.g., "[module-path] [type]"). */
    argumentHint?: string;
    /** List of allowed tools for this skill (empty = all tools). */
    allowedTools: string[];
    /** The markdown body (instructions for the LLM). */
    body: string;
    /** Absolute path to the SKILL.md file (for debugging). */
    sourcePath?: string;
}

/** Parameters for invoking a skill. */
export interface SkillInvocation {
    skillName: string;
    args: string[];
}

// ============================================
// Sub-agents
// ============================================

/** Request to spawn a sub-agent. */
export interface SubAgentRequest {
    /** The prompt/task for the sub-agent. */
    prompt: string;
    /** Maximum iterations for the sub-agent (default: 10). */
    maxIterations?: number;
    /** Filter tools available to the sub-agent (empty = all tools). */
    allowedTools?: string[];
    /** Override the system prompt for the sub-agent. */
    systemPromptOverride?: string;
}

/** Result from a completed sub-agent. */
export interface SubAgentResult {
    success: boolean;
    output: string;
    iterationsUsed: number;
}

// ============================================
// MCP (Model Context Protocol)
// ============================================

/** Configuration for an MCP server. */
export interface McpServerConfig {
    /** Unique server name. */
    name: string;
    /** Transport type. */
    transport: 'stdio' | 'sse';
    /** Command to spawn (for stdio transport). */
    command?: string;
    /** Command arguments (for stdio transport). */
    args?: string[];
    /** Environment variables (for stdio transport). */
    env?: Record<string, string>;
    /** Server URL (for SSE transport). */
    url?: string;
}

/** Information about a tool provided by an MCP server. */
export interface McpToolInfo {
    /** The MCP server this tool belongs to. */
    serverName: string;
    /** Tool name as reported by the MCP server. */
    name: string;
    /** Tool description. */
    description: string;
    /** JSON Schema for the tool's input. */
    inputSchema: Record<string, unknown>;
}
