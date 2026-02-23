/**
 * VS Code Webview API bridge.
 *
 * In the VS Code webview runtime, `acquireVsCodeApi()` is injected as a global.
 * This module wraps it with typed helpers for postMessage / onMessage / state
 * persistence so the rest of the React app never touches the raw API directly.
 *
 * The types duplicate the message protocol from src/types/messages.ts because
 * the webview bundle is built separately (Vite) and cannot import from the
 * extension host source tree.  The canonical types live in state/types.ts.
 */

import type { WebviewToExtensionMessage, ExtensionToWebviewMessage } from './state/types';

// ------------------------------------------------------------------ raw API
interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Acquire once; VS Code throws if you call acquireVsCodeApi() more than once.
let api: VsCodeApi | undefined;

function getApi(): VsCodeApi {
    if (!api) {
        try {
            api = acquireVsCodeApi();
        } catch {
            // Running outside VS Code (e.g. Vite dev server). Provide a stub so
            // the app renders without crashing.
            console.warn('[vscode bridge] acquireVsCodeApi not available – using stub');
            api = {
                postMessage: (msg: unknown) => console.log('[vscode stub] postMessage', msg),
                getState: () => null,
                setState: (_s: unknown) => {},
            };
        }
    }
    return api;
}

// ----------------------------------------------------------- public helpers

/** Send a typed message from the webview to the extension host. */
export function postMessage(message: WebviewToExtensionMessage): void {
    getApi().postMessage(message);
}

/**
 * Subscribe to messages sent from the extension host to the webview.
 * Returns an unsubscribe function.
 */
export function onMessage(handler: (message: ExtensionToWebviewMessage) => void): () => void {
    const listener = (event: MessageEvent) => {
        const msg = event.data as ExtensionToWebviewMessage;
        if (msg && typeof msg.type === 'string') {
            handler(msg);
        }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
}

/** Persist webview state (survives tab switches). */
export function setState<T>(state: T): void {
    getApi().setState(state);
}

/** Retrieve previously persisted webview state. */
export function getState<T>(): T | undefined {
    return getApi().getState() as T | undefined;
}
