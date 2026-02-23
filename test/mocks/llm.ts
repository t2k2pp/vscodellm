import { vi } from 'vitest';

/**
 * Mock LLM provider for testing
 */
export function createMockLlmProvider() {
    return {
        id: 'mock-provider',
        name: 'Mock Provider',
        testConnection: vi.fn().mockResolvedValue({ ok: true }),
        listModels: vi.fn().mockResolvedValue([
            {
                id: 'mock-model',
                name: 'Mock Model',
                contextWindow: 4096,
                supportsToolCalling: true,
                supportsStreaming: true,
            },
        ]),
        streamCompletion: vi.fn(),
        complete: vi.fn(),
        countTokens: vi.fn().mockReturnValue(10),
        getModelInfo: vi.fn().mockResolvedValue({
            id: 'mock-model',
            name: 'Mock Model',
            contextWindow: 4096,
            supportsToolCalling: true,
            supportsStreaming: true,
        }),
        dispose: vi.fn(),
    };
}

/**
 * Create a mock streaming response
 */
export function createMockStreamResponse(text: string) {
    const chunks = text.split(' ').map((word, i, arr) => ({
        id: 'mock-completion',
        choices: [
            {
                delta: { content: word + (i < arr.length - 1 ? ' ' : '') },
                finish_reason: i === arr.length - 1 ? 'stop' : null,
            },
        ],
    }));
    return chunks;
}
