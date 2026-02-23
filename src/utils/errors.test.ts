import { describe, it, expect } from 'vitest';
import {
    AgentError,
    AbortError,
    ToolExecutionError,
    PathValidationError,
    CommandBlockedError,
} from './errors.js';

describe('Custom Errors', () => {
    it('AgentError should have code', () => {
        const err = new AgentError('test error', 'ERR_TEST');
        expect(err.message).toBe('test error');
        expect(err.code).toBe('ERR_TEST');
        expect(err.name).toBe('AgentError');
        expect(err instanceof Error).toBe(true);
    });

    it('AbortError should have default message', () => {
        const err = new AbortError();
        expect(err.message).toBe('Operation was aborted');
        expect(err.name).toBe('AbortError');
    });

    it('ToolExecutionError should include tool name', () => {
        const err = new ToolExecutionError('read_file', 'file not found');
        expect(err.message).toContain('read_file');
        expect(err.toolName).toBe('read_file');
    });

    it('PathValidationError should include path and reason', () => {
        const err = new PathValidationError('/etc/passwd', 'outside workspace');
        expect(err.path).toBe('/etc/passwd');
        expect(err.reason).toBe('outside workspace');
    });

    it('CommandBlockedError should include command and reason', () => {
        const err = new CommandBlockedError('rm -rf /', 'dangerous');
        expect(err.command).toBe('rm -rf /');
        expect(err.reason).toBe('dangerous');
    });
});
