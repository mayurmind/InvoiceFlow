'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { getDashboardSummaryApi, DashboardSummary } from '@/lib/api/dashboard';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useAuth } from '@/features/auth/AuthContext';
import {
  TrendingUp,
  CreditCard,
  FilePlus,
  ArrowUpRight,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function DashboardPage() {
  const { role } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardSummaryApi();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="badge badge-paid">PAID</span>;
      case 'SENT':
        return <span className="badge badge-sent">SENT</span>;
      case 'PARTIALLY_PAID':
        return <span className="badge badge-partially-paid">PARTIALLY PAID</span>;
      case 'DRAFT':
        return <span className="badge badge-draft">DRAFT</span>;
      case 'CANCELLED':
      default:
        return <span className="badge badge-cancelled">{status}</span>;
    }
  };

  return (
    <>
      <AppHeader
        title="Financial Overview"
        subtitle="Real-time revenue, outstanding receivables, and invoice lifecycle metrics."
      />

      <main className="page-wrapper">
        {/* Header Action Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Performance Summary
            </h2>
          </div>
          {role !== 'VIEWER' && (
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
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
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

        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2rem',
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card skeleton" style={{ height: '120px' }} />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Top Metric Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem',
              }}
            >
              {/* Total Outstanding */}
              <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                    }}
                  >
                    Total Outstanding
                  </span>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--warning-subtle)',
                      color: 'var(--warning)',
                    }}
                  >
                    <Clock size={18} />
                  </div>
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {formatCurrency(data.outstandingAmount)}
                </div>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.5rem',
                  }}
                >
                  Uncollected invoice balance
                </p>
              </div>

              {/* Total Paid */}
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                    }}
                  >
                    Total Collected
                  </span>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--success-subtle)',
                      color: 'var(--success)',
                    }}
                  >
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: 'var(--success)',
                  }}
                >
                  {formatCurrency(data.paidAmount)}
                </div>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.5rem',
                  }}
                >
                  Total reconciled payments
                </p>
              </div>

              {/* Active Invoices Breakdown */}
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                    }}
                  >
                    Invoice Status Counts
                  </span>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--primary-subtle)',
                      color: 'var(--primary)',
                    }}
                  >
                    <FileText size={18} />
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sent: </span>
                    <strong style={{ color: 'var(--info)' }}>
                      {data.invoiceStatusCounts.SENT}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Partial:{' '}
                    </span>
                    <strong style={{ color: 'var(--warning)' }}>
                      {data.invoiceStatusCounts.PARTIALLY_PAID}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Paid: </span>
                    <strong style={{ color: 'var(--success)' }}>
                      {data.invoiceStatusCounts.PAID}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Draft: </span>
                    <strong style={{ color: 'var(--text-secondary)' }}>
                      {data.invoiceStatusCounts.DRAFT}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid for Recent Invoices and Recent Payments */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {/* Recent Invoices Table */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Recent Invoices</h3>
                  <Link
                    href="/invoices"
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    View all <ArrowUpRight size={14} />
                  </Link>
                </div>

                {data.recentInvoices.length === 0 ? (
                  <p
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      padding: '2rem 0',
                    }}
                  >
                    No invoices generated yet.
                  </p>
                ) : (
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Client</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td>
                              <Link
                                href={`/invoices/${inv.id}`}
                                style={{ fontWeight: 600, color: 'var(--primary)' }}
                              >
                                {inv.invoiceNumber || 'Draft (Unissued)'}
                              </Link>
                            </td>
                            <td>{inv.clientName}</td>
                            <td>{formatDate(inv.dueDate)}</td>
                            <td>{getStatusBadge(inv.status)}</td>
                            <td
                              className="tabular-nums"
                              style={{ textAlign: 'right', fontWeight: 600 }}
                            >
                              {formatCurrency(inv.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Payments Table */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Recent Payments</h3>
                  <div
                    style={{
                      padding: '0.375rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                    }}
                  >
                    <CreditCard size={16} color="var(--text-muted)" />
                  </div>
                </div>

                {data.recentPayments.length === 0 ? (
                  <p
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      padding: '2rem 0',
                    }}
                  >
                    No payment transactions recorded yet.
                  </p>
                ) : (
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentPayments.map((pay) => (
                          <tr key={pay.id}>
                            <td>{formatDate(pay.paidAt)}</td>
                            <td>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {pay.method.replace('_', ' ')}
                              </span>
                            </td>
                            <td>
                              {pay.status === 'COMPLETED' ? (
                                <span className="badge badge-paid" style={{ fontSize: '0.65rem' }}>
                                  COMPLETED
                                </span>
                              ) : (
                                <span
                                  className="badge badge-cancelled"
                                  style={{ fontSize: '0.65rem' }}
                                >
                                  REVERSED
                                </span>
                              )}
                            </td>
                            <td
                              className="tabular-nums"
                              style={{
                                textAlign: 'right',
                                fontWeight: 600,
                                color:
                                  pay.status === 'COMPLETED'
                                    ? 'var(--success)'
                                    : 'var(--text-muted)',
                              }}
                            >
                              {formatCurrency(pay.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}
