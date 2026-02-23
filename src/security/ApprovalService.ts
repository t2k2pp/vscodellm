/**
 * Manages the approval flow for dangerous operations.
 * In auto-approve mode, operations are approved implicitly.
 * In safe mode, the user is prompted through the webview.
 */

import type { ApprovalRequest, ExtensionSettings } from '../types/messages.js';
import type { StateManager } from '../state/StateManager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ApprovalService');

/**
 * Interface for posting messages to the webview.
 * Abstracted to avoid direct dependency on WebviewProvider in this module.
 */
export interface ApprovalMessageSender {
    postMessage(message: { type: 'approvalRequired'; approval: ApprovalRequest }): void;
    postMessage(message: { type: 'approvalDismissed' }): void;
}

export class ApprovalService {
    constructor(
        private settings: ExtensionSettings,
        private stateManager: StateManager,
        private messageSender: ApprovalMessageSender,
    ) {}

    /**
     * Update settings (e.g., when user changes auto-approve preferences).
     */
    updateSettings(settings: ExtensionSettings): void {
        this.settings = settings;
    }

    /**
     * Request approval for an operation.
     * Returns true if approved, false if rejected.
     */
    async requestApproval(request: ApprovalRequest): Promise<boolean> {
        // Check auto-approve settings first
        if (this.shouldAutoApprove(request)) {
            logger.debug(`Auto-approved: ${request.type} - ${request.description}`);
            return true;
        }

        logger.info(`Requesting approval: ${request.type} - ${request.description}`);

        // Send approval request to webview
        this.messageSender.postMessage({
            type: 'approvalRequired',
            approval: request,
        });

        // Wait for user response (resolved by MessageRouter calling resolveApproval)
        const approved = await this.stateManager.requestApproval(request.id);

        // Dismiss the approval dialog in the webview
        this.messageSender.postMessage({ type: 'approvalDismissed' });

        logger.info(`Approval ${approved ? 'granted' : 'rejected'}: ${request.type}`);
        return approved;
    }

    private shouldAutoApprove(request: ApprovalRequest): boolean {
        switch (request.type) {
            case 'file_edit':
            case 'file_write':
                return this.settings.approval.autoApproveWrites;
            case 'file_delete':
                return false; // Never auto-approve deletes
            case 'command_execution': {
                if (!this.settings.approval.autoApproveCommands) return false;
                const command = request.details.command || '';
                // Check against allowed command patterns
                return this.settings.approval.allowedCommands.some(
                    (pattern) => {
                        try {
                            return new RegExp(pattern).test(command);
                        } catch {
                            return false;
                        }
                    }
                );
            }
            default:
                return false;
        }
    }
}
