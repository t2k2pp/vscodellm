/**
 * SkillRegistry - Manages loaded skill definitions.
 *
 * Provides lookup, listing, and LLM-friendly description generation.
 */

import type { SkillDefinition } from '../../types/skills.js';

export class SkillRegistry {
    private skills = new Map<string, SkillDefinition>();

    /** Register a skill. */
    register(skill: SkillDefinition): void {
        this.skills.set(skill.name, skill);
    }

    /** Register multiple skills at once. */
    registerAll(skills: SkillDefinition[]): void {
        for (const skill of skills) {
            this.skills.set(skill.name, skill);
        }
    }

    /** Get a skill by name. */
    get(name: string): SkillDefinition | undefined {
        return this.skills.get(name);
    }

    /** Get all registered skills. */
    getAll(): SkillDefinition[] {
        return Array.from(this.skills.values());
    }

    /** Get all registered skill names. */
    getNames(): string[] {
        return Array.from(this.skills.keys());
    }

    /** Check if a skill exists. */
    has(name: string): boolean {
        return this.skills.has(name);
    }

    /** Remove a skill. */
    unregister(name: string): boolean {
        return this.skills.delete(name);
    }

    /** Clear all skills. */
    clear(): void {
        this.skills.clear();
    }

    /** Get the number of registered skills. */
    get size(): number {
        return this.skills.size;
    }

    /**
     * Generate an LLM-friendly description of all available skills.
     * This text is injected into the system prompt so the LLM knows
     * which skills it can invoke.
     */
    getSkillListDescription(): string {
        const skills = this.getAll();
        if (skills.length === 0) {
            return '';
        }

        const lines = skills.map((s) => {
            const argPart = s.argumentHint ? ` (arguments: ${s.argumentHint})` : '';
            return `- **${s.name}**: ${s.description}${argPart}`;
        });

        return [
            '## Available Skills',
            '',
            'Use the `invoke_skill` tool to execute these reusable procedures:',
            '',
            ...lines,
        ].join('\n');
    }
}
