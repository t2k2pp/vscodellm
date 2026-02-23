/**
 * Structured logger for the extension.
 * Uses VSCode OutputChannel when available, falls back to console.
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

type OutputChannel = {
    appendLine(value: string): void;
    dispose(): void;
};

let globalLevel = LogLevel.INFO;
let outputChannel: OutputChannel | null = null;

export function setLogLevel(level: LogLevel): void {
    globalLevel = level;
}

export function setOutputChannel(channel: OutputChannel): void {
    outputChannel = channel;
}

function formatMessage(level: string, component: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${component}] ${message}`;
}

function log(level: LogLevel, levelName: string, component: string, message: string, data?: unknown): void {
    if (level < globalLevel) return;

    const formatted = formatMessage(levelName, component, message);

    if (outputChannel) {
        outputChannel.appendLine(formatted);
        if (data !== undefined) {
            outputChannel.appendLine(`  ${JSON.stringify(data, null, 2)}`);
        }
    } else {
        const consoleFn = level >= LogLevel.ERROR ? console.error : level >= LogLevel.WARN ? console.warn : console.log;
        if (data !== undefined) {
            consoleFn(formatted, data);
        } else {
            consoleFn(formatted);
        }
    }
}

export function createLogger(component: string) {
    return {
        debug: (message: string, data?: unknown) => log(LogLevel.DEBUG, 'DEBUG', component, message, data),
        info: (message: string, data?: unknown) => log(LogLevel.INFO, 'INFO', component, message, data),
        warn: (message: string, data?: unknown) => log(LogLevel.WARN, 'WARN', component, message, data),
        error: (message: string, data?: unknown) => log(LogLevel.ERROR, 'ERROR', component, message, data),
    };
}
