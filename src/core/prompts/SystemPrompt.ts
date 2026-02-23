/**
 * System prompt builder.
 * Assembles the system prompt from templates and tool descriptions.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { SkillDefinition } from '../../types/skills.js';

// Load template at module level (path relative to compiled output)
const TEMPLATE_DIR = path.join(__dirname, 'templates');

function loadTemplate(name: string): string {
    try {
        return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8');
    } catch {
        // Fallback: try relative to source directory
        const srcDir = path.join(__dirname, '..', '..', 'core', 'prompts', 'templates');
        try {
            return fs.readFileSync(path.join(srcDir, name), 'utf8');
        } catch {
            return '';
        }
    }
}

export class SystemPrompt {
    private baseTemplate: string;

    constructor(private toolRegistry: ToolRegistry) {
        this.baseTemplate = loadTemplate('system.md');
    }

    /**
     * Build the complete system prompt.
     */
    build(options: {
        workspaceRoot: string;
        useXmlTools?: boolean;
        skills?: SkillDefinition[];
    }): string {
        let prompt = this.baseTemplate.replace('{{workspaceRoot}}', options.workspaceRoot);

        // Append tool descriptions for XML fallback mode
        if (options.useXmlTools) {
            const toolDescriptions = this.toolRegistry.getToolDescriptions();
            prompt += `\n\n## Available Tools (XML Format)\n\nWhen you want to use a tool, wrap the call in XML tags:\n\n\`\`\`xml\n<tool_call>\n<tool_name>tool_name_here</tool_name>\n<parameters>\n{"param1": "value1"}\n</parameters>\n</tool_call>\n\`\`\`\n\n${toolDescriptions}`;
        }

        // Append available skills section
        if (options.skills && options.skills.length > 0) {
            prompt += '\n\n' + SystemPrompt.buildSkillsSection(options.skills);
        }

        return prompt;
    }

    /**
     * Build the skills section for the system prompt.
     */
    static buildSkillsSection(skills: SkillDefinition[]): string {
        if (skills.length === 0) return '';

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

    /**
     * Get the compaction prompt template.
     */
    static getCompactionPrompt(conversation: string): string {
        const template = loadTemplate('compaction.md');
        return template.replace('{{conversation}}', conversation);
    }
}
