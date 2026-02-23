import { describe, it, expect } from 'vitest';
import { ToolCallAccumulator, parseXmlToolCalls, stripToolCallXml } from './StreamProcessor.js';

describe('ToolCallAccumulator', () => {
    it('should accumulate tool call deltas', () => {
        const acc = new ToolCallAccumulator();

        acc.addDelta({ index: 0, id: 'call_1', function: { name: 'read_file', arguments: '' } });
        acc.addDelta({ index: 0, function: { name: '', arguments: '{"path":' } });
        acc.addDelta({ index: 0, function: { name: '', arguments: ' "/foo"}' } });

        const calls = acc.getCompleted();
        expect(calls).toHaveLength(1);
        expect(calls[0].id).toBe('call_1');
        expect(calls[0].function.name).toBe('read_file');
        expect(calls[0].function.arguments).toBe('{"path": "/foo"}');
    });

    it('should handle multiple concurrent tool calls', () => {
        const acc = new ToolCallAccumulator();

        acc.addDelta({ index: 0, id: 'call_1', function: { name: 'read_file', arguments: '{"path":"/a"}' } });
        acc.addDelta({ index: 1, id: 'call_2', function: { name: 'list_files', arguments: '{}' } });

        const calls = acc.getCompleted();
        expect(calls).toHaveLength(2);
        expect(calls[0].function.name).toBe('read_file');
        expect(calls[1].function.name).toBe('list_files');
    });

    it('should clear state', () => {
        const acc = new ToolCallAccumulator();
        acc.addDelta({ index: 0, id: 'call_1', function: { name: 'test', arguments: '{}' } });
        acc.clear();
        expect(acc.getCompleted()).toHaveLength(0);
        expect(acc.hasToolCalls).toBe(false);
    });
});

describe('parseXmlToolCalls', () => {
    it('should parse XML tool calls from text', () => {
        const text = `Some text before
<tool_call>
<tool_name>read_file</tool_name>
<parameters>
{"path": "/foo/bar.ts"}
</parameters>
</tool_call>
Some text after`;

        const calls = parseXmlToolCalls(text);
        expect(calls).toHaveLength(1);
        expect(calls[0].function.name).toBe('read_file');
        expect(JSON.parse(calls[0].function.arguments)).toEqual({ path: '/foo/bar.ts' });
    });

    it('should parse multiple XML tool calls', () => {
        const text = `
<tool_call>
<tool_name>read_file</tool_name>
<parameters>{"path": "/a"}</parameters>
</tool_call>
<tool_call>
<tool_name>list_files</tool_name>
<parameters>{"path": "/b"}</parameters>
</tool_call>`;

        const calls = parseXmlToolCalls(text);
        expect(calls).toHaveLength(2);
    });

    it('should return empty for text without tool calls', () => {
        expect(parseXmlToolCalls('no tool calls here')).toHaveLength(0);
    });
});

describe('stripToolCallXml', () => {
    it('should remove tool call XML from text', () => {
        const text = `Before <tool_call>
<tool_name>test</tool_name>
<parameters>{}</parameters>
</tool_call> After`;

        const stripped = stripToolCallXml(text);
        expect(stripped).toBe('Before  After');
    });
});
