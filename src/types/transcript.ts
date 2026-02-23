/**
 * Transcript types for JSONL-based conversation logging.
 *
 * Each agent interaction is persisted as a JSONL file
 * (one JSON object per line) so that conversation details
 * survive context compaction and can be searched later.
 */

/** Type of a single transcript entry. */
export type TranscriptEntryType =
    | 'user_message'
    | 'assistant_message'
    | 'tool_call'
    | 'tool_result'
    | 'context_compacted'
    | 'agent_start'
    | 'agent_complete'
    | 'agent_error';

/** A single line in the JSONL transcript file. */
export interface TranscriptEntry {
    /** Unix millisecond timestamp. */
    timestamp: number;
    /** Conversation this entry belongs to. */
    conversationId: string;
    /** Entry type discriminator. */
    type: TranscriptEntryType;

    // --- Message fields ---
    /** Message role (user_message / assistant_message). */
    role?: 'user' | 'assistant' | 'system' | 'tool';
    /** Text content of the message. */
    content?: string;
    /** Tool calls requested by the assistant. */
    toolCalls?: { id: string; name: string; arguments: string }[];

    // --- Tool execution fields ---
    /** tool_call_id linking a result back to its call. */
    toolCallId?: string;
    /** Name of the tool that was executed. */
    toolName?: string;
    /** Parameters passed to the tool (parsed). */
    toolParams?: Record<string, unknown>;
    /** Text output returned by the tool. */
    toolResult?: string;
    /** Whether the tool execution succeeded. */
    toolSuccess?: boolean;

    // --- Compaction fields ---
    /** Summary text produced during context compaction. */
    summary?: string;

    // --- Agent lifecycle fields ---
    /** Iteration number within the agent loop. */
    iteration?: number;
    /** Arbitrary metadata. */
    metadata?: Record<string, unknown>;
}

/** Options for searching transcript entries. */
export interface TranscriptSearchOptions {
    /** Maximum number of results to return (default: 20). */
    maxResults?: number;
    /** Only include entries of these types. */
    entryTypes?: TranscriptEntryType[];
}

/** A single search hit. */
export interface TranscriptSearchResult {
    /** The matched entry. */
    entry: TranscriptEntry;
    /** 1-based line number in the JSONL file. */
    lineNumber: number;
    /** Snippet of text that matched the query. */
    matchedText: string;
}

/** Summary info returned by listTranscripts(). */
export interface TranscriptInfo {
    conversationId: string;
    /** File size in bytes. */
    size: number;
    /** Last-modified timestamp (Unix ms). */
    modifiedAt: number;
}
