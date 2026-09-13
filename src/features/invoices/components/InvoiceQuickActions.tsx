import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../auth/hooks/useAuth';
import { apiClient } from '../../../lib/api/client';
import { invoicesApi } from '../api/invoices.api';
import type { InvoiceStatus } from '../types/invoice.types';

// Minimal invoice shape needed by this component.
// Both InvoiceListItemResponse and the dashboard's recent invoice shape satisfy this.
export type QuickActionInvoice = {
  id: string;
  status: InvoiceStatus;
  outstandingAmount: string;
  sentAt: string | null;
};

interface InvoiceQuickActionsProps {
  invoice: QuickActionInvoice;
  /** Called when a modal-based action (record_payment, cancel) is requested. */
  onActionIntent: (
    action: 'record_payment' | 'cancel',
    invoiceId: string,
    outstandingAmount: string,
  ) => void;
  /** Called after a direct API action succeeds (Issue, Send/Resend). */
  onRefreshRequired: () => void;
}

export function InvoiceQuickActions({
  invoice,
  onActionIntent,
  onRefreshRequired,
}: InvoiceQuickActionsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const [isIssuing, setIsIssuing] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF';

  // ── Status-derived booleans (backend-verified rules) ──────────────────────
  // Cancel: only SENT, and only when backend hasn't blocked it (we surface errors from API).
  const canCancel = canEdit && invoice.status === 'SENT';
  // Record Payment: SENT or PARTIALLY_PAID.
  const canRecordPayment =
    canEdit && (invoice.status === 'SENT' || invoice.status === 'PARTIALLY_PAID');
  // Issue: DRAFT only.
  const canIssue = canEdit && invoice.status === 'DRAFT';
  // Email: backend rejects DRAFT and CANCELLED.
  const isEmailable =
    canEdit && invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED';
  // Send vs Resend: use sentAt as proxy for delivery history.
  const hasBeenSent = invoice.sentAt !== null;

  // ── Close on outside click ─────────────────────────────────────────────────
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    setIsOpen(false);
    setIsDownloadingPdf(true);
    try {
      const blob = await apiClient.get<Blob>(`/invoices/${invoice.id}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // PDF download does NOT trigger onRefreshRequired (read-only action).
    } catch {
      alert('Unable to download invoice PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSendEmail = async (isResend: boolean) => {
    setIsOpen(false);
    setIsSendingEmail(true);
    try {
      const endpoint = isResend
        ? `/invoices/${invoice.id}/resend`
        : `/invoices/${invoice.id}/send`;
      await apiClient.post(endpoint, { body: {} });
      // Email sent/resent successfully → refresh table to update sentAt.
      onRefreshRequired();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : `Unable to ${isResend ? 'resend' : 'send'} invoice.`);
      // On failure: do NOT refresh.
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleIssueInvoice = async () => {
    setIsOpen(false);
    setIsIssuing(true);
    try {
      await invoicesApi.issueInvoice(invoice.id);
      // Issue succeeded → refresh table.
      onRefreshRequired();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to issue invoice.');
      // On failure: do NOT refresh.
    } finally {
      setIsIssuing(false);
    }
  };

  const isBusy = isIssuing || isSendingEmail || isDownloadingPdf;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isBusy}
        data-testid={`quick-actions-${invoice.id}`}
        aria-label="Quick actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="sr-only">Open quick actions menu</span>
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 w-52 origin-top-right rounded-md border bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1">
            {/* ── Always visible ─────────────────────────────────── */}
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(`/invoices/${invoice.id}`);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
              data-testid={`action-view-${invoice.id}`}
            >
              View Details
            </button>

            <button
              onClick={handleDownloadPdf}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
              data-testid={`action-pdf-${invoice.id}`}
            >
              {isDownloadingPdf ? 'Downloading…' : 'Download PDF'}
            </button>

            {/* ── SUPER_ADMIN / STAFF only ────────────────────────── */}
            {canEdit && (
              <>
                {/* Duplicate: any status, SUPER_ADMIN/STAFF only */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate(`/invoices/new?cloneFrom=${invoice.id}`);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  data-testid={`action-duplicate-${invoice.id}`}
                >
                  Duplicate
                </button>

                {/* Issue: DRAFT only */}
                {canIssue && (
                  <button
                    onClick={handleIssueInvoice}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 font-medium"
                    role="menuitem"
                    data-testid={`action-issue-${invoice.id}`}
                  >
                    {isIssuing ? 'Issuing…' : 'Issue Invoice'}
                  </button>
                )}

                {/* Send Email: not DRAFT, not CANCELLED, no prior sentAt */}
                {isEmailable && !hasBeenSent && (
                  <button
                    onClick={() => handleSendEmail(false)}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                    data-testid={`action-send-${invoice.id}`}
                  >
                    {isSendingEmail ? 'Sending…' : 'Send Email'}
                  </button>
                )}

                {/* Resend Email: not DRAFT, not CANCELLED, has prior sentAt */}
                {isEmailable && hasBeenSent && (
                  <button
                    onClick={() => handleSendEmail(true)}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                    data-testid={`action-resend-${invoice.id}`}
                  >
                    {isSendingEmail ? 'Sending…' : 'Resend Email'}
                  </button>
                )}

                {/* Record Payment: SENT or PARTIALLY_PAID */}
                {canRecordPayment && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onActionIntent('record_payment', invoice.id, invoice.outstandingAmount);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50"
                    role="menuitem"
                    data-testid={`action-payment-${invoice.id}`}
                  >
                    Record Payment
                  </button>
                )}

                {/* Cancel: SENT only */}
                {canCancel && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onActionIntent('cancel', invoice.id, invoice.outstandingAmount);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    role="menuitem"
                    data-testid={`action-cancel-${invoice.id}`}
                  >
                    Cancel Invoice
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
