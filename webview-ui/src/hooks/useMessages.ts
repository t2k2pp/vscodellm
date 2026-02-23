/**
 * Hook exposing actions that send messages to the extension host.
 *
 * Each function is a thin wrapper around `postMessage` with the correct
 * discriminated-union payload.  Components call these instead of reaching
 * for the raw bridge, keeping message construction in one place.
 */

import { useCallback } from 'react';
import { postMessage } from '../vscode';
import type { ExtensionSettings } from '../state/types';

export function useMessages() {
    const sendMessage = useCallback((text: string) => {
        if (!text.trim()) return;
        postMessage({ type: 'sendMessage', text: text.trim() });
    }, []);

    const cancelTask = useCallback(() => {
        postMessage({ type: 'cancelTask' });
    }, []);

    const approveAction = useCallback((approvalId: string) => {
        postMessage({ type: 'approveAction', approvalId });
    }, []);

    const rejectAction = useCallback((approvalId: string) => {
        postMessage({ type: 'rejectAction', approvalId });
    }, []);

    const testConnection = useCallback(() => {
        postMessage({ type: 'testConnection' });
    }, []);

    const listModels = useCallback(() => {
        postMessage({ type: 'listModels' });
    }, []);

    const newConversation = useCallback(() => {
        postMessage({ type: 'newConversation' });
    }, []);

    const loadConversation = useCallback((conversationId: string) => {
        postMessage({ type: 'loadConversation', conversationId });
    }, []);

    const deleteConversation = useCallback((conversationId: string) => {
        postMessage({ type: 'deleteConversation', conversationId });
    }, []);

    const updateSettings = useCallback((settings: Partial<ExtensionSettings>) => {
        postMessage({ type: 'updateSettings', settings });
    }, []);

    const requestState = useCallback(() => {
        postMessage({ type: 'getState' });
    }, []);

    return {
        sendMessage,
        cancelTask,
        approveAction,
        rejectAction,
        testConnection,
        listModels,
        updateSettings,
        newConversation,
        loadConversation,
        deleteConversation,
        requestState,
    };
}
