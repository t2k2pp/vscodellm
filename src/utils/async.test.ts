import { describe, it, expect, vi } from 'vitest';
import { withRetry, delay, withTimeout, deferred, debounce } from './async.js';

describe('withRetry', () => {
    it('returns result on first success', async () => {
        const fn = vi.fn().mockResolvedValue('ok');
        const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually succeeds', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockRejectedValueOnce(new Error('fail 2'))
            .mockResolvedValue('ok');

        const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting retries', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('always fails'));

        await expect(
            withRetry(fn, { maxRetries: 2, initialDelayMs: 1 })
        ).rejects.toThrow('always fails');
        expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('respects isRetryable predicate', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('not retryable'));

        await expect(
            withRetry(fn, {
                maxRetries: 3,
                initialDelayMs: 1,
                isRetryable: () => false,
            })
        ).rejects.toThrow('not retryable');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback', async () => {
        const onRetry = vi.fn();
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValue('ok');

        await withRetry(fn, { maxRetries: 2, initialDelayMs: 1, onRetry });
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 1);
    });
});

describe('withTimeout', () => {
    it('resolves within timeout', async () => {
        const result = await withTimeout(Promise.resolve('ok'), 1000);
        expect(result).toBe('ok');
    });

    it('rejects when timeout is exceeded', async () => {
        const slow = new Promise((resolve) => setTimeout(resolve, 5000));
        await expect(withTimeout(slow, 10, 'too slow')).rejects.toThrow('too slow');
    });
});

describe('deferred', () => {
    it('creates a manually resolvable promise', async () => {
        const d = deferred<string>();
        d.resolve('resolved');
        const result = await d.promise;
        expect(result).toBe('resolved');
    });

    it('can be rejected', async () => {
        const d = deferred<string>();
        d.reject(new Error('rejected'));
        await expect(d.promise).rejects.toThrow('rejected');
    });
});

describe('delay', () => {
    it('waits for specified time', async () => {
        const start = Date.now();
        await delay(50);
        expect(Date.now() - start).toBeGreaterThanOrEqual(40);
    });
});

describe('debounce', () => {
    it('debounces function calls', async () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 50);
        debounced();
        debounced();
        debounced();
        await delay(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('cancel prevents execution', async () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 50);
        debounced();
        debounced.cancel();
        await delay(100);
        expect(fn).toHaveBeenCalledTimes(0);
    });
});
