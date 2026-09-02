'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  getInvoiceApi,
  issueInvoiceApi,
  cancelInvoiceApi,
  getInvoicePdfBlobApi,
  sendInvoiceEmailApi,
  resendInvoiceEmailApi,
  getInvoiceEmailDeliveriesApi,
  Invoice,
  EmailDelivery,
} from '@/lib/api/invoices';
import { recordPaymentApi, reversePaymentApi, PaymentMethod } from '@/lib/api/payments';
import { formatCurrency, formatDate, formatPercentage } from '@/lib/formatters';
import { useAuth } from '@/features/auth/AuthContext';
import {
  ChevronLeft,
  FileCheck,
  FileDown,
  Mail,
  Ban,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const { role } = useAuth();
  const isReadOnly = role === 'VIEWER';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [emailDeliveries, setEmailDeliveries] = useState<EmailDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  const loadInvoice = async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getInvoiceApi(invoiceId);
      setInvoice(res.invoice);

      // Load email deliveries
      try {
        const deliveriesRes = await getInvoiceEmailDeliveriesApi(invoiceId);
        setEmailDeliveries(deliveriesRes.emailDeliveries || []);
      } catch {
        // Email deliveries may be empty
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const handleIssue = async () => {
    if (!invoice) return;
    if (
      !confirm(
        'Are you sure you want to officially issue this invoice? This will lock line items and assign the formal sequence number.',
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await issueInvoiceApi(invoice.id);
      setInvoice(res.invoice);
      setSuccessMessage('Invoice issued successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to issue invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const blob = await getInvoicePdfBlobApi(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invoice.invoiceNumber || invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate and download PDF');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendEmail = async (isResend = false) => {
    if (!invoice) return;
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (isResend) {
        await resendInvoiceEmailApi(invoice.id);
        setSuccessMessage('Invoice email re-queued for delivery.');
      } else {
        await sendInvoiceEmailApi(invoice.id);
        setSuccessMessage('Invoice email dispatched to client.');
      }
      loadInvoice();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invoice email');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    if (cancelReason.trim().length < 10) {
      setError('Cancellation reason must be at least 10 characters.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await cancelInvoiceApi(invoice.id, cancelReason.trim());
      setInvoice(res.invoice);
      setIsCancelModalOpen(false);
      setCancelReason('');
      setSuccessMessage('Invoice cancelled successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setActionLoading(true);
    setError(null);
    try {
      await recordPaymentApi(invoice.id, {
        amount: paymentAmount,
        method: paymentMethod,
        reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      setSuccessMessage('Payment recorded and reconciled successfully.');
      loadInvoice();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !selectedPaymentId) return;

    setActionLoading(true);
    setError(null);
    try {
      await reversePaymentApi(invoice.id, selectedPaymentId, {
        reversalReason: reverseReason.trim(),
      });
      setIsReverseModalOpen(false);
      setSelectedPaymentId(null);
      setReverseReason('');
      setSuccessMessage('Payment reversed successfully.');
      loadInvoice();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reverse payment');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (s?: string) => {
    switch (s) {
      case 'PAID':
        return <span className="badge badge-paid">PAID</span>;
      case 'SENT':
        return <span className="badge badge-sent">SENT</span>;
      case 'PARTIALLY_PAID':
        return <span className="badge badge-partially-paid">PARTIAL</span>;
      case 'DRAFT':
        return <span className="badge badge-draft">DRAFT</span>;
      case 'CANCELLED':
      default:
        return <span className="badge badge-cancelled">CANCELLED</span>;
    }
  };

  return (
    <>
      <AppHeader
        title={invoice?.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : 'Draft Invoice'}
        subtitle="Manage invoice lifecycle, tax breakdown, PDF exports, and payment receipts."
      />

      <main className="page-wrapper">
        <div
          style={{
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/invoices"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            <ChevronLeft size={16} />
            <span>Back to Invoices</span>
          </Link>
        </div>

        {error && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--danger-subtle)',
              color: 'var(--danger)',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--success-subtle)',
              color: 'var(--success)',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="card skeleton" style={{ height: '450px' }} />
        ) : invoice ? (
          <>
            {/* Top Action Bar & Status Header */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <h2
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {invoice.invoiceNumber || 'Draft (Unissued)'}
                  </h2>
                  {getStatusBadge(invoice.status)}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Download PDF button */}
                  <button
                    onClick={handleDownloadPdf}
                    className="btn btn-secondary"
                    disabled={actionLoading}
                  >
                    <FileDown size={16} />
                    <span>PDF</span>
                  </button>

                  {!isReadOnly && invoice.status === 'DRAFT' && (
                    <button
                      onClick={handleIssue}
                      className="btn btn-primary"
                      disabled={actionLoading}
                    >
                      <FileCheck size={16} />
                      <span>Issue Invoice</span>
                    </button>
                  )}

                  {!isReadOnly && ['SENT', 'PARTIALLY_PAID', 'PAID'].includes(invoice.status) && (
                    <button
                      onClick={() => handleSendEmail(emailDeliveries.length > 0)}
                      className="btn btn-secondary"
                      disabled={actionLoading}
                    >
                      <Mail size={16} />
                      <span>{emailDeliveries.length > 0 ? 'Resend Email' : 'Send Email'}</span>
                    </button>
                  )}

                  {!isReadOnly && ['SENT', 'PARTIALLY_PAID'].includes(invoice.status) && (
                    <button
                      onClick={() => {
                        setPaymentAmount(invoice.outstandingAmount);
                        setIsPaymentModalOpen(true);
                      }}
                      className="btn btn-primary"
                      disabled={actionLoading}
                    >
                      <CreditCard size={16} />
                      <span>Record Payment</span>
                    </button>
                  )}

                  {!isReadOnly && invoice.status !== 'CANCELLED' && (
                    <button
                      onClick={() => setIsCancelModalOpen(true)}
                      className="btn btn-danger"
                      disabled={actionLoading}
                    >
                      <Ban size={16} />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Particulars Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              {/* Client Info Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Bill To</h3>
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '1rem',
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {invoice.client?.name}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {invoice.client?.addressLine1}
                    {invoice.client?.city && `, ${invoice.client.city}`}
                    {invoice.client?.state && `, ${invoice.client.state}`}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    GSTIN:{' '}
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {invoice.client?.gstin || 'Unregistered'}
                    </span>
                  </div>
                  {invoice.client?.email && (
                    <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Email:{' '}
                      <span style={{ color: 'var(--text-primary)' }}>{invoice.client.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Metadata Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Dates & Location</h3>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Invoice Date
                    </span>
                    <div style={{ fontWeight: 600 }}>{formatDate(invoice.invoiceDate)}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Due Date
                    </span>
                    <div style={{ fontWeight: 600 }}>{formatDate(invoice.dueDate)}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Place of Supply
                    </span>
                    <div style={{ fontWeight: 600 }}>
                      State Code: {invoice.placeOfSupplyStateCode}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Issued At
                    </span>
                    <div style={{ fontWeight: 600 }}>
                      {invoice.issuedAt ? formatDate(invoice.issuedAt) : 'Unissued'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h3 className="card-title">Itemized Line Items</h3>
              </div>

              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>SAC</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Discount</th>
                      <th style={{ textAlign: 'right' }}>Taxable</th>
                      <th style={{ textAlign: 'right' }}>GST Rate</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{it.description}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {it.sacCode || '—'}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right' }}>
                          {it.quantity}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right' }}>
                          {formatCurrency(it.rate)}
                        </td>
                        <td
                          className="tabular-nums"
                          style={{ textAlign: 'right', color: 'var(--text-muted)' }}
                        >
                          {formatCurrency(it.discountAmount)}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right' }}>
                          {formatCurrency(
                            it.taxableAmount ||
                              parseFloat(it.rate) * parseFloat(it.quantity) -
                                parseFloat(it.discountAmount),
                          )}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right' }}>
                          {formatPercentage(it.gstRate)}
                        </td>
                        <td
                          className="tabular-nums"
                          style={{ textAlign: 'right', fontWeight: 600 }}
                        >
                          {formatCurrency(it.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals Summary */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '1.5rem',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: '380px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>Subtotal:</span>
                    <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {parseFloat(invoice.totalDiscount) > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>Discount:</span>
                      <span className="tabular-nums">
                        - {formatCurrency(invoice.totalDiscount)}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>Taxable Amount:</span>
                    <span className="tabular-nums">{formatCurrency(invoice.totalTaxable)}</span>
                  </div>
                  {parseFloat(invoice.totalCgst) > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>CGST:</span>
                      <span className="tabular-nums">{formatCurrency(invoice.totalCgst)}</span>
                    </div>
                  )}
                  {parseFloat(invoice.totalSgst) > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>SGST:</span>
                      <span className="tabular-nums">{formatCurrency(invoice.totalSgst)}</span>
                    </div>
                  )}
                  {parseFloat(invoice.totalIgst) > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>IGST:</span>
                      <span className="tabular-nums">{formatCurrency(invoice.totalIgst)}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      fontSize: '1.125rem',
                      color: 'var(--text-primary)',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '0.75rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    <span>Total (INR):</span>
                    <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: 'var(--success)',
                      fontWeight: 600,
                    }}
                  >
                    <span>Amount Paid:</span>
                    <span className="tabular-nums">{formatCurrency(invoice.paidAmount)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color:
                        parseFloat(invoice.outstandingAmount) > 0
                          ? 'var(--warning)'
                          : 'var(--text-muted)',
                      fontWeight: 700,
                    }}
                  >
                    <span>Outstanding Balance:</span>
                    <span className="tabular-nums">
                      {formatCurrency(invoice.outstandingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Deliveries Trail */}
            {emailDeliveries.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Email Dispatch History</h3>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Sent Date</th>
                        <th>Status</th>
                        <th>Provider Message ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailDeliveries.map((ed) => (
                        <tr key={ed.id}>
                          <td>{ed.recipientEmail}</td>
                          <td>{formatDate(ed.createdAt)}</td>
                          <td>
                            <span
                              className={`badge ${ed.status === 'SENT' || ed.status === 'DELIVERED' ? 'badge-paid' : 'badge-cancelled'}`}
                            >
                              {ed.status}
                            </span>
                          </td>
                          <td
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {ed.providerMessageId || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && invoice && (
        <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Record Payment</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="btn btn-ghost btn-sm">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="form-group">
                <label className="form-label" htmlFor="pay-amt">
                  Payment Amount (₹) *
                </label>
                <input
                  id="pay-amt"
                  type="text"
                  className="form-input"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.25rem',
                  }}
                >
                  Maximum outstanding: {formatCurrency(invoice.outstandingAmount)}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-method">
                  Payment Method *
                </label>
                <select
                  id="pay-method"
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  required
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-ref">
                  Transaction Reference #
                </label>
                <input
                  id="pay-ref"
                  type="text"
                  className="form-input"
                  placeholder="e.g. UTR / Cheque / Txn ID"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-notes">
                  Internal Notes
                </label>
                <textarea
                  id="pay-notes"
                  className="form-textarea"
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Payment Modal */}
      {isReverseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReverseModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--danger)' }}>
                Reverse Payment
              </h2>
              <button onClick={() => setIsReverseModalOpen(false)} className="btn btn-ghost btn-sm">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReversePayment}>
              <div className="form-group">
                <label className="form-label" htmlFor="revReason">
                  Reversal Reason *
                </label>
                <input
                  id="revReason"
                  type="text"
                  className="form-input"
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsReverseModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={actionLoading || !reverseReason.trim()}
                >
                  {actionLoading ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {isCancelModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCancelModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--danger)' }}>
                Cancel Invoice
              </h2>
              <button onClick={() => setIsCancelModalOpen(false)} className="btn btn-ghost btn-sm">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit}>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1rem',
                }}
              >
                Please provide a clear justification for cancelling this invoice. This action is
                immutable and will be recorded in the security audit trail.
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="cancelReason">
                  Reason for Cancellation (Min 10 chars) *
                </label>
                <textarea
                  id="cancelReason"
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Duplicate draft created by mistake / Client requested contract revision..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={actionLoading || cancelReason.trim().length < 10}
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
