import { vi } from 'vitest';

export const workspace = {
    fs: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        stat: vi.fn(),
        readDirectory: vi.fn(),
        createDirectory: vi.fn(),
        delete: vi.fn(),
    },
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' }, name: 'mock', index: 0 }],
    getConfiguration: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
    })),
    createFileSystemWatcher: vi.fn(() => ({
        onDidCreate: vi.fn(),
        onDidChange: vi.fn(),
        onDidDelete: vi.fn(),
        dispose: vi.fn(),
    })),
    findFiles: vi.fn(),
    openTextDocument: vi.fn(),
};

export const window = {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createTerminal: vi.fn(),
    registerWebviewViewProvider: vi.fn(),
    activeTextEditor: undefined,
    visibleTextEditors: [],
    onDidChangeActiveTextEditor: vi.fn(),
};

export const commands = {
    registerCommand: vi.fn(),
    executeCommand: vi.fn(),
};

export const Uri = {
    file: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
    parse: (str: string) => ({ fsPath: str, scheme: str.split(':')[0], path: str }),
    joinPath: (...args: { fsPath?: string }[]) => ({
        fsPath: args.map((a) => a.fsPath || String(a)).join('/'),
    }),
};

export class EventEmitter<T> {
    private handlers: ((data: T) => void)[] = [];
    event = (handler: (data: T) => void) => {
        this.handlers.push(handler);
        return { dispose: () => this.handlers.splice(this.handlers.indexOf(handler), 1) };
    };
    fire = (data: T) => {
        this.handlers.forEach((h) => h(data));
    };
    dispose = () => {
        this.handlers = [];
    };
}

export class CancellationTokenSource {
    token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
    cancel = vi.fn();
    dispose = vi.fn();
}

export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
}

export class Disposable {
    constructor(private callOnDispose: () => void) {}
    static from(...disposables: { dispose: () => void }[]) {
        return new Disposable(() => disposables.forEach((d) => d.dispose()));
    }
    dispose() {
        this.callOnDispose();
    }
}
