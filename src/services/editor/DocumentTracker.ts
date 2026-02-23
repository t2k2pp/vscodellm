/**
 * DocumentTracker – monitors open editors in VS Code.
 *
 * Tracks which files are currently open in the editor so the agent can
 * have awareness of the user's working context. This allows the system prompt
 * to include information about open files without the agent having to search.
 *
 * Uses VS Code API so it lives in src/services/, not src/core/.
 */

import * as vscode from 'vscode';

interface TrackedDocument {
    /** Absolute file path */
    path: string;
    /** Language ID (e.g., 'typescript', 'python') */
    languageId: string;
    /** Whether the document has unsaved changes */
    isDirty: boolean;
    /** Line count */
    lineCount: number;
    /** Last time this document was the active editor */
    lastActiveAt: number;
}

export class DocumentTracker implements vscode.Disposable {
    private readonly _tracked = new Map<string, TrackedDocument>();
    private readonly _disposables: vscode.Disposable[] = [];

    constructor() {
        // Track currently open editors
        this._disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this._trackEditor(editor);
                }
            }),
        );

        this._disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                this._trackDocument(doc);
            }),
        );

        this._disposables.push(
            vscode.workspace.onDidCloseTextDocument((doc) => {
                this._tracked.delete(doc.uri.fsPath);
            }),
        );

        this._disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                const tracked = this._tracked.get(e.document.uri.fsPath);
                if (tracked) {
                    tracked.isDirty = e.document.isDirty;
                    tracked.lineCount = e.document.lineCount;
                }
            }),
        );

        // Track initial open editors
        for (const editor of vscode.window.visibleTextEditors) {
            this._trackEditor(editor);
        }
    }

    /**
     * Get a list of currently tracked documents, sorted by most recently active.
     */
    getOpenDocuments(): TrackedDocument[] {
        return Array.from(this._tracked.values())
            .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    }

    /**
     * Get tracked documents as a summary string for the system prompt.
     * Example: "Open files: main.ts (TypeScript, 150 lines), utils.ts (TypeScript, 45 lines, modified)"
     */
    getSummary(): string {
        const docs = this.getOpenDocuments();
        if (docs.length === 0) return '';

        const entries = docs.map((doc) => {
            const basename = doc.path.split(/[/\\]/).pop() ?? doc.path;
            const parts = [basename, doc.languageId, `${doc.lineCount} lines`];
            if (doc.isDirty) parts.push('modified');
            return parts.join(', ');
        });

        return `Open files: ${entries.join('; ')}`;
    }

    /**
     * Get the path of the currently active editor file, if any.
     */
    getActiveFilePath(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        return editor?.document.uri.fsPath;
    }

    private _trackEditor(editor: vscode.TextEditor): void {
        const doc = editor.document;
        this._tracked.set(doc.uri.fsPath, {
            path: doc.uri.fsPath,
            languageId: doc.languageId,
            isDirty: doc.isDirty,
            lineCount: doc.lineCount,
            lastActiveAt: Date.now(),
        });
    }

    private _trackDocument(doc: vscode.TextDocument): void {
        // Skip non-file documents (e.g., output panels, untitled)
        if (doc.uri.scheme !== 'file') return;

        if (!this._tracked.has(doc.uri.fsPath)) {
            this._tracked.set(doc.uri.fsPath, {
                path: doc.uri.fsPath,
                languageId: doc.languageId,
                isDirty: doc.isDirty,
                lineCount: doc.lineCount,
                lastActiveAt: Date.now(),
            });
        }
    }

    dispose(): void {
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables.length = 0;
        this._tracked.clear();
    }
}
