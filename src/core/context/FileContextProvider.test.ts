import { describe, it, expect, beforeEach } from 'vitest';
import { FileContextProvider } from './FileContextProvider.js';

describe('FileContextProvider', () => {
    let provider: FileContextProvider;

    beforeEach(() => {
        provider = new FileContextProvider();
    });

    it('returns undefined for uncached files', () => {
        expect(provider.getCached('/foo/bar.ts')).toBeUndefined();
    });

    it('stores and retrieves cached content', () => {
        provider.put('/foo/bar.ts', 'const x = 1;', 10, 1000);
        expect(provider.getCached('/foo/bar.ts')).toBe('const x = 1;');
    });

    it('invalidates cache when file is modified', () => {
        provider.put('/foo/bar.ts', 'old content', 10, 1000);
        // File was modified at time 2000, which is after our read at 1000
        expect(provider.getCached('/foo/bar.ts', 2000)).toBeUndefined();
    });

    it('returns cached content when file has not been modified', () => {
        provider.put('/foo/bar.ts', 'content', 10, 1000);
        expect(provider.getCached('/foo/bar.ts', 1000)).toBe('content');
    });

    it('tracks total token count', () => {
        provider.put('/a.ts', 'aaa', 100);
        provider.put('/b.ts', 'bbb', 200);
        expect(provider.totalTokens).toBe(300);
    });

    it('updates token count on re-put', () => {
        provider.put('/a.ts', 'old', 100);
        provider.put('/a.ts', 'new', 50);
        expect(provider.totalTokens).toBe(50);
    });

    it('invalidate removes from cache and updates tokens', () => {
        provider.put('/a.ts', 'content', 100);
        provider.invalidate('/a.ts');
        expect(provider.getCached('/a.ts')).toBeUndefined();
        expect(provider.totalTokens).toBe(0);
    });

    it('getSummary returns empty string for empty cache', () => {
        expect(provider.getSummary()).toBe('');
    });

    it('getSummary lists cached files', () => {
        provider.put('/src/foo.ts', 'content', 100);
        provider.put('/src/bar.ts', 'content', 200);
        const summary = provider.getSummary();
        expect(summary).toContain('foo.ts');
        expect(summary).toContain('bar.ts');
        expect(summary).toContain('100 tokens');
    });

    it('clear resets everything', () => {
        provider.put('/a.ts', 'x', 50);
        provider.put('/b.ts', 'y', 50);
        provider.clear();
        expect(provider.size).toBe(0);
        expect(provider.totalTokens).toBe(0);
    });
});
