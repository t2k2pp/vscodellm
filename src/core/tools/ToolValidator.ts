/**
 * Basic JSON Schema validation for tool parameters.
 * Lightweight validation without external library dependency.
 */

import type { Tool, ValidationResult } from './types.js';

export class ToolValidator {
    /**
     * Validate tool parameters against the tool's parameterSchema.
     */
    validate(tool: Tool, params: Record<string, unknown>): ValidationResult {
        const errors: string[] = [];
        const schema = tool.parameterSchema;

        // Check required fields
        const required = (schema.required as string[]) || [];
        for (const field of required) {
            if (params[field] === undefined || params[field] === null) {
                errors.push(`Missing required parameter: ${field}`);
            }
        }

        // Check types for provided properties
        const properties = (schema.properties as Record<string, { type?: string }>) || {};
        for (const [key, value] of Object.entries(params)) {
            const propSchema = properties[key];
            if (!propSchema) continue; // Extra properties are allowed

            if (propSchema.type && !this.checkType(value, propSchema.type)) {
                errors.push(`Parameter "${key}" should be of type ${propSchema.type}, got ${typeof value}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    private checkType(value: unknown, expectedType: string): boolean {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
            case 'integer':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            default:
                return true;
        }
    }
}
