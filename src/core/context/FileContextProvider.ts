/**
 * FileContextProvider – tracks which files have been read in the current conversation
 * to avoid redundant file reads.
 *
 * When the agent reads a file, the content is cached with its modification time.
 * Subsequent reads of the same file are served from cache unless the file has been
 * modified since the last read.
 *
 * IMPORTANT: This file is in src/core/ and must NOT import vscode.
 */

interface CachedFile {
    /** The content that was read */
    content: string;
    /** Timestamp when the file was last read */
    readAt: number;
    /** File modification time at the time of read (if available) */
    modifiedAt?: number;
    /** Approximate token count of the content */
    tokenCount: number;
}

export class FileContextProvider {
    private readonly _cache = new Map<string, CachedFile>();
    private _totalTokens = 0;

    /**
     * Check if a file is cached and still fresh.
     * Returns the cached content if valid, or undefined if a re-read is needed.
     *
     * @param filePath - Normalized absolute file path
     * @param currentModifiedAt - Current file modification time (if available)
     */
    getCached(filePath: string, currentModifiedAt?: number): string | undefined {
        const cached = this._cache.get(filePath);
        if (!cached) return undefined;

        // If we have modification times, compare them
        if (currentModifiedAt !== undefined && cached.modifiedAt !== undefined) {
            if (currentModifiedAt > cached.modifiedAt) {
                // File has been modified since last read
                return undefined;
            }
        }

        return cached.content;
    }

    /**
     * Store the content of a file read.
     *
     * @param filePath - Normalized absolute file path
     * @param content - File content
     * @param tokenCount - Approximate token count
     * @param modifiedAt - File modification time
     */
    put(filePath: string, content: string, tokenCount: number, modifiedAt?: number): void {
        const existing = this._cache.get(filePath);
        if (existing) {
            this._totalTokens -= existing.tokenCount;
        }

        this._cache.set(filePath, {
            content,
            readAt: Date.now(),
            modifiedAt,
            tokenCount,
        });
        this._totalTokens += tokenCount;
    }

    /**
     * Invalidate a specific file's cache (e.g., after the agent edits it).
     */
    invalidate(filePath: string): void {
        const existing = this._cache.get(filePath);
        if (existing) {
            this._totalTokens -= existing.tokenCount;
            this._cache.delete(filePath);
        }
    }

    /**
     * Get all cached file paths.
     */
    getCachedPaths(): string[] {
        return Array.from(this._cache.keys());
    }

    /**
     * Get the total token count across all cached files.
     */
    get totalTokens(): number {
        return this._totalTokens;
    }

    /**
     * Get the number of cached files.
     */
    get size(): number {
        return this._cache.size;
    }

    /**
     * Generate a summary of cached files for inclusion in compaction context.
     * Returns a string like: "Files in context: foo.ts (150 tokens), bar.ts (200 tokens)"
     */
    getSummary(): string {
        if (this._cache.size === 0) return '';

        const entries = Array.from(this._cache.entries())
            .map(([path, cached]) => {
                const basename = path.split(/[/\\]/).pop() ?? path;
                return `${basename} (${cached.tokenCount} tokens)`;
            })
            .join(', ');

        return `Files in context: ${entries}`;
    }

    /**
     * Clear all cached files.
     */
    clear(): void {
        this._cache.clear();
        this._totalTokens = 0;
    }
}
