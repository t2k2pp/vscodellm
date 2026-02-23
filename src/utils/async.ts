/**
 * Async utility functions.
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
