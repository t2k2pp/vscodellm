import { describe, it, expect } from 'vitest';
import { ConversationHistory } from './ConversationHistory.js';

describe('ConversationHistory', () => {
    it('should add and retrieve messages', () => {
        const history = new ConversationHistory();
        history.addMessage({ role: 'user', content: 'hello' });
        history.addMessage({ role: 'assistant', content: 'hi there' });

        const messages = history.getMessages();
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('user');
        expect(messages[1].role).toBe('assistant');
    });

    it('should return a copy of messages (not the internal array)', () => {
        const history = new ConversationHistory();
        history.addMessage({ role: 'user', content: 'test' });

        const msgs = history.getMessages();
        msgs.push({ role: 'assistant', content: 'injected' });

        expect(history.getMessages()).toHaveLength(1);
    });

    it('should track length', () => {
        const history = new ConversationHistory();
        expect(history.length).toBe(0);
        history.addMessage({ role: 'user', content: 'test' });
        expect(history.length).toBe(1);
    });

    it('should replace with summary', () => {
        const history = new ConversationHistory();
        history.addMessage({ role: 'user', content: 'msg1' });
        history.addMessage({ role: 'assistant', content: 'msg2' });
        history.addMessage({ role: 'user', content: 'msg3' });
        history.addMessage({ role: 'assistant', content: 'msg4' });

        const recent = [
            { role: 'user' as const, content: 'msg3' },
            { role: 'assistant' as const, content: 'msg4' },
        ];

        history.replaceWithSummary('Summary of earlier conversation', recent);

        const messages = history.getMessages();
        expect(messages).toHaveLength(3); // summary + 2 recent
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toContain('Summary');
        expect(messages[1].content).toBe('msg3');
        expect(messages[2].content).toBe('msg4');
    });

    it('should clear all messages', () => {
        const history = new ConversationHistory();
        history.addMessage({ role: 'user', content: 'test' });
        history.clear();
        expect(history.length).toBe(0);
    });
});
