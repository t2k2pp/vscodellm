/**
 * SkillExecutor - Expands and executes skill definitions.
 *
 * Takes a SkillDefinition and user arguments, expands the template
 * ($0, $1, ... placeholders), and returns the expanded prompt text
 * for injection into the conversation.
 */

import type { SkillDefinition } from '../../types/skills.js';
import { SkillExecutionError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('SkillExecutor');

export class SkillExecutor {
    /**
     * Expand a skill's body template with the given arguments.
     *
     * Replaces `$0`, `$1`, etc. with the corresponding argument values.
     * Returns the fully expanded prompt string ready for LLM consumption.
     */
    expandBody(skill: SkillDefinition, args: string[]): string {
        let expanded = skill.body;

        // Replace positional arguments $0, $1, $2, ...
        for (let i = 0; i < args.length; i++) {
            expanded = expanded.replace(new RegExp(`\\$${i}`, 'g'), args[i]);
        }

        return expanded;
    }

    /**
     * Execute a skill by expanding it and formatting as an LLM prompt.
     *
     * Returns a formatted prompt string that includes the skill's instructions
     * and user arguments, ready to be sent to the LLM.
     */
    execute(skill: SkillDefinition, args: string[]): string {
        try {
            const expandedBody = this.expandBody(skill, args);

            const parts: string[] = [
                `[Skill: ${skill.name}]`,
                '',
                expandedBody,
            ];

            if (args.length > 0) {
                parts.push('');
                parts.push(`User arguments: ${args.join(' ')}`);
            }

            const result = parts.join('\n');
            logger.info(`Executed skill "${skill.name}" with ${args.length} argument(s)`);
            return result;
        } catch (error) {
            throw new SkillExecutionError(
                skill.name,
                error instanceof Error ? error.message : String(error),
                error instanceof Error ? error : undefined,
            );
        }
    }

    /**
     * Parse a skill invocation string into skill name and arguments.
     *
     * Input format: "skill-name arg1 arg2 ..."
     * Supports quoted arguments: "skill-name \"arg with spaces\" arg2"
     */
    static parseInvocation(input: string): { skillName: string; args: string[] } {
        const trimmed = input.trim();
        if (!trimmed) {
            throw new SkillExecutionError('', 'Empty skill invocation');
        }

        const tokens = SkillExecutor.tokenize(trimmed);
        const skillName = tokens[0];
        const args = tokens.slice(1);

        return { skillName, args };
    }

    /**
     * Tokenize a string, respecting quoted segments.
     */
    private static tokenize(input: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < input.length; i++) {
            const ch = input[i];

            if (inQuotes) {
                if (ch === quoteChar) {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else if (ch === '"' || ch === "'") {
                inQuotes = true;
                quoteChar = ch;
            } else if (ch === ' ' || ch === '\t') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            } else {
                current += ch;
            }
        }

        if (current) {
            tokens.push(current);
        }

        return tokens;
    }
}
