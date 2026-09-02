'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import { getClientApi, Client } from '@/lib/api/clients';
import { getInvoicesApi, Invoice } from '@/lib/api/invoices';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useAuth } from '@/features/auth/AuthContext';
import { Mail, Phone, MapPin, FilePlus, ChevronLeft, ArrowUpRight } from 'lucide-react';

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params?.id as string;
  const { role } = useAuth();
  const isReadOnly = role === 'VIEWER';

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!clientId) return;
      setLoading(true);
      setError(null);
      try {
        const [clientRes, invoicesRes] = await Promise.all([
          getClientApi(clientId),
          getInvoicesApi({ clientId, limit: 50 }),
        ]);
        setClient(clientRes.client);
        setInvoices(invoicesRes.invoices);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load client details');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [clientId]);

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
        title={client ? client.name : 'Client Particulars'}
        subtitle="Enterprise client details and billing history."
      />

      <main className="page-wrapper">
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/clients"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            <ChevronLeft size={16} />
            <span>Back to Client Directory</span>
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
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="card skeleton" style={{ height: '300px' }} />
        ) : client ? (
          <>
            {/* Client Particulars Card */}
            <div className="card" style={{ marginBottom: '2rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h2
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {client.name}
                    </h2>
                    <span
                      className={`badge ${client.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}
                    >
                      {client.status}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '1.5rem',
                      marginTop: '1rem',
                      flexWrap: 'wrap',
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {client.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Mail size={16} />
                        <span>{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Phone size={16} />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <MapPin size={16} />
                      <span>
                        {client.city}, {client.state} (Code: {client.stateCode})
                      </span>
                    </div>
                  </div>
                </div>

                {!isReadOnly && (
                  <Link href={`/invoices/new?clientId=${client.id}`} className="btn btn-primary">
                    <FilePlus size={16} />
                    <span>Create Invoice</span>
                  </Link>
                )}
              </div>

              {/* Tax Information Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginTop: '1.5rem',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GSTIN</span>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {client.gstin || 'Not Registered'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PAN</span>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {client.pan || '—'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Postal Code
                  </span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {client.postalCode}
                  </div>
                </div>
              </div>
            </div>

            {/* Invoices History Table */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Invoices History ({invoices.length})</h3>
              </div>

              {invoices.length === 0 ? (
                <p
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    padding: '2rem 0',
                  }}
                >
                  No invoices generated for this client yet.
                </p>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Issue Date</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td>
                            <Link
                              href={`/invoices/${inv.id}`}
                              style={{ fontWeight: 600, color: 'var(--primary)' }}
                            >
                              {inv.invoiceNumber || 'Draft (Unissued)'}
                            </Link>
                          </td>
                          <td>{formatDate(inv.invoiceDate)}</td>
                          <td>{formatDate(inv.dueDate)}</td>
                          <td>{getStatusBadge(inv.status)}</td>
                          <td
                            className="tabular-nums"
                            style={{ textAlign: 'right', fontWeight: 600 }}
                          >
                            {formatCurrency(inv.total)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Link href={`/invoices/${inv.id}`} className="btn btn-ghost btn-sm">
                              View <ArrowUpRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}
