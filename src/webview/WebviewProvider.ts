import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage } from '../types/messages.js';
import { MessageRouter } from './MessageRouter.js';
import { StateManager } from '../state/StateManager.js';

/**
 * Provides the sidebar webview panel for the chat interface.
 * Registered as 'localLlmAgent.chatView' in package.json.
 */
export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'localLlmAgent.chatView';

    private _view: vscode.WebviewView | undefined;
    private _messageRouter: MessageRouter | undefined;
    private readonly _extensionUri: vscode.Uri;
    private readonly _disposables: vscode.Disposable[] = [];

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._extensionUri = _context.extensionUri;
    }

    /**
     * Called by VS Code when the webview view is first resolved (made visible).
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        // Configure webview options
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview'),
                vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist'),
            ],
        };

        // Set HTML content
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Retain context when the webview is hidden
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                // Re-sync state when the view becomes visible again
                this._syncState();
            }
        });

        // Create message router for this webview
        this._messageRouter = new MessageRouter(webviewView.webview);
        this._disposables.push(this._messageRouter);

        // Listen for state changes and forward to webview
        const stateManager = StateManager.instance;
        this._disposables.push(
            stateManager.onDidChangeState((state) => {
                this.postMessage({ type: 'syncState', state });
            })
        );

        this._disposables.push(
            stateManager.onDidAddMessage((message) => {
                this.postMessage({ type: 'messageAdded', message });
            })
        );

        // Dispose when the view is disposed
        webviewView.onDidDispose(() => {
            this._disposeAll();
        });

        // Send initial state
        this._syncState();
    }

    /**
     * Post a typed message to the webview.
     */
    postMessage(message: ExtensionToWebviewMessage): void {
        if (this._view) {
            void this._view.webview.postMessage(message);
        }
    }

    /**
     * Reveal the webview panel.
     */
    reveal(): void {
        if (this._view) {
            this._view.show(true);
        }
    }

    /**
     * Whether the webview is currently visible.
     */
    get visible(): boolean {
        return this._view?.visible ?? false;
    }

    /**
     * Send the current syncable state to the webview.
     */
    private _syncState(): void {
        const stateManager = StateManager.instance;
        this.postMessage({
            type: 'syncState',
            state: stateManager.getSyncableState(),
        });
    }

    /**
     * Generate the HTML content for the webview, including CSP with nonce.
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = _generateNonce();

        // Resolve URIs for the webview bundle
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.css')
        );

        // VS Code toolkit / codicons
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                'node_modules',
                '@vscode/codicons',
                'dist',
                'codicon.css'
            )
        );

        const cspSource = webview.cspSource;

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${cspSource} 'unsafe-inline';
                   font-src ${cspSource};
                   script-src 'nonce-${nonce}';
                   img-src ${cspSource} https: data:;
                   connect-src ${cspSource};">
    <link rel="stylesheet" href="${styleUri}">
    <link rel="stylesheet" href="${codiconsUri}">
    <title>Local LLM Agent</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Dispose all internal disposables.
     */
    private _disposeAll(): void {
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables.length = 0;
        this._messageRouter = undefined;
        this._view = undefined;
    }
}

// ============================================
// Nonce generator
// ============================================

/**
 * Generate a random nonce string for CSP.
 */
function _generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}
