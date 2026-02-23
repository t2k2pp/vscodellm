/**
 * Command sanitization for shell command execution.
 * Blocks dangerous commands and warns about potentially risky ones.
 */

import type { ExtensionSettings } from '../types/messages.js';

export interface SanitizeResult {
    safe: boolean;
    reason?: string;
    warning?: string;
}

export class CommandSanitizer {
    private readonly blockedPatterns: RegExp[];
    private readonly warningPatterns: RegExp[];

    constructor(settings: ExtensionSettings) {
        this.blockedPatterns = [
            /rm\s+(-rf|-fr)\s+[/~]/,       // rm -rf /
            /mkfs/,                          // Format disk
            /dd\s+if=/,                      // Disk write
            />\s*\/dev\//,                   // Write to devices
            /chmod\s+777/,                   // Overly permissive
            /curl\s+.*\|\s*(ba)?sh/,         // Piping curl to shell
            /wget\s+.*\|\s*(ba)?sh/,         // Piping wget to shell
        ];

        // Add user-configured blocked patterns
        for (const pattern of settings.approval.blockedCommands) {
            try {
                this.blockedPatterns.push(new RegExp(pattern));
            } catch {
                // Invalid regex pattern, skip
            }
        }

        this.warningPatterns = [
            /sudo\s/,
            /git\s+push/,
            /npm\s+publish/,
            /docker\s+rm/,
            /git\s+reset\s+--hard/,
            /git\s+clean\s+-fd/,
        ];
    }

    /**
     * Check if a command is safe to execute.
     */
    sanitize(command: string): SanitizeResult {
        // Check empty command
        if (!command.trim()) {
            return { safe: false, reason: 'Empty command' };
        }

        // Check blocked patterns
        for (const pattern of this.blockedPatterns) {
            if (pattern.test(command)) {
                return {
                    safe: false,
                    reason: `Command matches blocked pattern: ${pattern.source}`,
                };
            }
        }

        // Check warning patterns
        for (const pattern of this.warningPatterns) {
            if (pattern.test(command)) {
                return {
                    safe: true,
                    warning: `Potentially dangerous command: matches ${pattern.source}`,
                };
            }
        }

        return { safe: true };
    }
}
