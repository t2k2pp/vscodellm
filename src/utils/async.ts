/**
 * Async utility functions.
 *
 * IMPORTANT: This file is in src/utils/ and must NOT import vscode.
 */

/**
 * Create a debounced version of a function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delayMs: number,
): T & { cancel: () => void } {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const debounced = ((...args: unknown[]) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delayMs);
    }) as T & { cancel: () => void };

    debounced.cancel = () => {
        if (timer) clearTimeout(timer);
    };

    return debounced;
}

/**
 * Wait for a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise (manually resolvable).
 */
export function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/**
 * Run with a timeout. Rejects if the operation takes longer than timeoutMs.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message?: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message || `Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timer!);
    }
}

/**
 * Retry options for the withRetry function.
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Initial delay in ms before first retry (default: 1000) */
    initialDelayMs?: number;
    /** Multiplier for exponential backoff (default: 2) */
    backoffMultiplier?: number;
    /** Maximum delay between retries in ms (default: 30000) */
    maxDelayMs?: number;
    /** Optional predicate to determine if an error is retryable */
    isRetryable?: (error: unknown) => boolean;
    /** Optional abort signal to cancel retries */
    signal?: AbortSignal;
    /** Optional callback called before each retry */
    onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;
}

/**
 * Execute a function with exponential backoff retry.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelayMs = 1000,
        backoffMultiplier = 2,
        maxDelayMs = 30_000,
        isRetryable = () => true,
        signal,
        onRetry,
    } = options;

    let lastError: unknown;
    let currentDelay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (signal?.aborted) {
                throw new Error('Retry aborted');
            }
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on the last attempt or if not retryable
            if (attempt >= maxRetries || !isRetryable(error)) {
                throw error;
            }

            if (signal?.aborted) {
                throw error;
            }

            // Notify before retry
            onRetry?.(attempt + 1, error, currentDelay);

            // Wait with exponential backoff
            await delay(currentDelay);
            currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
        }
    }

    throw lastError;
}
