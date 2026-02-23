/**
 * Context management type definitions.
 */

export interface ContextSettings {
    modelId: string;
    maxOutputTokens: number;
    contextSafetyRatio: number;
    systemPrompt: string;
}
