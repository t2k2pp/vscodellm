/**
 * InvokeSkillTool - Allows the agent to invoke a registered skill.
 *
 * The LLM sees the list of available skills in the system prompt and
 * can use this tool to execute any of them with the appropriate arguments.
 */

import type { Tool, ToolContext, ToolResult } from '../types.js';
import type { SkillRegistry } from '../../skills/SkillRegistry.js';
import { SkillExecutor } from '../../skills/SkillExecutor.js';

export class InvokeSkillTool implements Tool {
    readonly name = 'invoke_skill';
    readonly description =
        'Invoke a registered skill (reusable procedure). ' +
        'Skills are predefined step-by-step instructions for common tasks. ' +
        'Use the skill_name parameter to specify which skill to run, ' +
        'and pass any required arguments as a space-separated string.';

    readonly parameterSchema = {
        type: 'object',
        properties: {
            skill_name: {
                type: 'string',
                description: 'Name of the skill to invoke.',
            },
            arguments: {
                type: 'string',
                description:
                    'Space-separated arguments for the skill. ' +
                    'Use quotes for arguments containing spaces.',
            },
        },
        required: ['skill_name'],
        additionalProperties: false,
    };

    readonly requiresApproval = false;

    private readonly skillRegistry: SkillRegistry;
    private readonly skillExecutor: SkillExecutor;

    constructor(skillRegistry: SkillRegistry) {
        this.skillRegistry = skillRegistry;
        this.skillExecutor = new SkillExecutor();
    }

    async execute(
        params: Record<string, unknown>,
        _context: ToolContext,
    ): Promise<ToolResult> {
        const skillName = params['skill_name'] as string;
        if (!skillName) {
            return {
                success: false,
                output: 'Error: skill_name parameter is required.',
            };
        }

        const skill = this.skillRegistry.get(skillName);
        if (!skill) {
            const available = this.skillRegistry.getNames().join(', ');
            return {
                success: false,
                output: `Error: Skill "${skillName}" not found. Available skills: ${available || 'none'}`,
            };
        }

        // Parse arguments
        const argsString = (params['arguments'] as string) || '';
        let args: string[] = [];
        if (argsString.trim()) {
            const parsed = SkillExecutor.parseInvocation(`dummy ${argsString}`);
            args = parsed.args;
        }

        try {
            const expandedPrompt = this.skillExecutor.execute(skill, args);
            return {
                success: true,
                output: expandedPrompt,
                metadata: {
                    skillName: skill.name,
                    argsCount: args.length,
                },
            };
        } catch (error) {
            return {
                success: false,
                output: `Error executing skill "${skillName}": ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
