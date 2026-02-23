/**
 * EditorService – wraps VS Code editor APIs for diff preview and document management.
 *
 * Provides:
 * - Diff preview: show side-by-side diff for file edits
 * - Document opening: open files in the editor
 * - Text decoration: highlight ranges in open editors
 */

import * as vscode from 'vscode';

export class EditorService {
    /**
     * Show a diff between original and modified content in a VS Code diff editor.
     */
    async showDiff(
        filePath: string,
        originalContent: string,
        modifiedContent: string,
        title?: string,
    ): Promise<void> {
        const originalUri = vscode.Uri.parse(
            `localllm-diff:original/${encodeURIComponent(filePath)}`,
        );
        const modifiedUri = vscode.Uri.parse(
            `localllm-diff:modified/${encodeURIComponent(filePath)}`,
        );

        // Register content providers for the diff
        const disposables: vscode.Disposable[] = [];

        const originalProvider = new InMemoryContentProvider(originalContent);
        const modifiedProvider = new InMemoryContentProvider(modifiedContent);

        disposables.push(
            vscode.workspace.registerTextDocumentContentProvider('localllm-diff', {
                provideTextDocumentContent(uri: vscode.Uri): string {
                    if (uri.path.startsWith('original/')) {
                        return originalProvider.content;
                    }
                    return modifiedProvider.content;
                },
            }),
        );

        const diffTitle = title ?? `Diff: ${this.basename(filePath)}`;
        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            modifiedUri,
            diffTitle,
            { preview: true },
        );

        // Clean up after a delay (editor keeps its own copy)
        setTimeout(() => {
            for (const d of disposables) {
                d.dispose();
            }
        }, 5000);
    }

    /**
     * Open a file in the editor at an optional line number.
     */
    async openFile(filePath: string, line?: number): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, {
            preview: true,
            preserveFocus: false,
        });

        if (line !== undefined && line > 0) {
            const position = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter,
            );
        }
    }

    /**
     * Get the content of the currently active editor.
     */
    getActiveEditorContent(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return undefined;
        return editor.document.getText();
    }

    /**
     * Get the file path of the currently active editor.
     */
    getActiveEditorPath(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return undefined;
        return editor.document.uri.fsPath;
    }

    private basename(filePath: string): string {
        const parts = filePath.split(/[/\\]/);
        return parts[parts.length - 1] || filePath;
    }
}

/**
 * Simple in-memory content provider for diff views.
 */
class InMemoryContentProvider {
    constructor(public readonly content: string) {}
}
