import React from 'react';
import type { PendingApproval } from '../../state/types';
import { DiffView } from '../diff/DiffView';
import { postMessage } from '../../vscode';

interface ApprovalDialogProps {
    approval: PendingApproval;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({ approval }) => {
    const handleApprove = () => {
        postMessage({ type: 'approveAction', approvalId: approval.id });
    };

    const handleReject = () => {
        postMessage({ type: 'rejectAction', approvalId: approval.id });
    };

    const typeLabel =
        approval.type === 'file_edit'
            ? 'Edit File'
            : approval.type === 'file_write'
              ? 'Write File'
              : approval.type === 'command_execution'
                ? 'Execute Command'
                : approval.type === 'file_delete'
                  ? 'Delete File'
                  : approval.type;

    return (
        <div className="approval-dialog">
            <div className="approval-header">
                <i className="codicon codicon-shield" />
                <span className="approval-title">Approval Required: {typeLabel}</span>
            </div>

            <div className="approval-body">
                <p className="approval-description">{approval.description}</p>

                {approval.details.path && (
                    <div className="approval-detail">
                        <strong>File:</strong> {approval.details.path}
                    </div>
                )}

                {approval.details.command && (
                    <div className="approval-detail">
                        <strong>Command:</strong>
                        <code>{approval.details.command}</code>
                        {approval.details.cwd && (
                            <span className="approval-cwd"> in {approval.details.cwd}</span>
                        )}
                    </div>
                )}

                {approval.details.diff && (
                    <DiffView diff={approval.details.diff} filePath={approval.details.path} />
                )}
            </div>

            <div className="approval-actions">
                <button className="btn btn-primary" onClick={handleApprove}>
                    <i className="codicon codicon-check" /> Approve
                </button>
                <button className="btn btn-secondary" onClick={handleReject}>
                    <i className="codicon codicon-close" /> Reject
                </button>
            </div>
        </div>
    );
};
