/**
 * Hook that bridges the extension host messages into the Zustand store.
 *
 * On mount it:
 *   1. Subscribes to `window` message events via the vscode bridge.
 *   2. Dispatches each incoming message to `store.handleExtensionMessage`.
 *   3. Sends a `getState` request so the extension host pushes a full
 *      `syncState` snapshot (covers cold start & tab re-show).
 *
 * On unmount it cleans up the listener.
 */

import { useEffect } from 'react';
import { onMessage, postMessage } from '../vscode';
import { useAppStore } from '../state/store';

export function useExtensionState(): void {
    const handleExtensionMessage = useAppStore((s) => s.handleExtensionMessage);

    useEffect(() => {
        // Subscribe to messages from the extension host.
        const unsubscribe = onMessage((msg) => {
            handleExtensionMessage(msg);
        });

        // Request initial state sync.
        postMessage({ type: 'getState' });

        return unsubscribe;
    }, [handleExtensionMessage]);
}
