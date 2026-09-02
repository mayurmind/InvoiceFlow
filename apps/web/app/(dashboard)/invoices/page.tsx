'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { getInvoicesApi, Invoice, InvoiceStatus } from '@/lib/api/invoices';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useAuth } from '@/features/auth/AuthContext';
import { FilePlus, Filter, ChevronRight } from 'lucide-react';

export default function InvoicesPage() {
  const { role } = useAuth();
  const isReadOnly = role === 'VIEWER';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInvoicesApi({
        page,
        limit: 15,
        status: status || undefined,
      });
      setInvoices(res.invoices);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, status]);

  const getStatusBadge = (s: InvoiceStatus) => {
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
        title="Invoices Ledger"
        subtitle="Generate, track, issue, and reconcile GST compliant invoices."
      />

      <main className="page-wrapper">
        {/* Controls Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
              }}
            >
              <Filter size={16} />
              <span>Status:</span>
            </div>
            <select
              className="form-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as InvoiceStatus | '');
                setPage(1);
              }}
              style={{ width: '160px' }}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {!isReadOnly && (
            <Link href="/invoices/new" className="btn btn-primary">
              <FilePlus size={16} />
              <span>Create Invoice</span>
            </Link>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--danger-subtle)',
              color: 'var(--danger)',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Invoices Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <div
                      className="animate-spin"
                      style={{
                        width: 24,
                        height: 24,
                        border: '2px solid var(--border-subtle)',
                        borderTopColor: 'var(--primary)',
                        borderRadius: '50%',
                        margin: '0 auto',
                      }}
                    />
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}
                  >
                    No invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link
                        href={`/invoices/${inv.id}`}
                        style={{
                          fontWeight: 600,
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <span>{inv.invoiceNumber || 'Draft (Unissued)'}</span>
                      </Link>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{inv.client?.name || '—'}</span>
                    </td>
                    <td>{formatDate(inv.invoiceDate)}</td>
                    <td>{formatDate(inv.dueDate)}</td>
                    <td>{getStatusBadge(inv.status)}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(inv.total)}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        color:
                          parseFloat(inv.outstandingAmount) > 0
                            ? 'var(--warning)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {formatCurrency(inv.outstandingAmount)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="btn btn-ghost btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <span>View</span>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
