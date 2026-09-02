'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { createInvoiceApi } from '@/lib/api/invoices';
import { getClientsApi, Client } from '@/lib/api/clients';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api/client';
import { ChevronLeft, Plus, Trash2, Save, AlertCircle } from 'lucide-react';

interface LineItemForm {
  description: string;
  sacCode: string;
  quantity: string;
  rate: string;
  discountAmount: string;
  gstRate: string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams?.get('clientId') || '';
  const { role } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(preselectedClientId);
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [dueDate, setDueDate] = useState(() => {
    const due = new Date();
    due.setDate(due.getDate() + 15);
    return due.toISOString().split('T')[0];
  });
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(
    'Payment is due within the stipulated days of invoice issuance.',
  );

  const [items, setItems] = useState<LineItemForm[]>([
    {
      description: 'Professional Consulting Services',
      sacCode: '998311',
      quantity: '1',
      rate: '10000.00',
      discountAmount: '0.00',
      gstRate: '18.00',
    },
  ]);

  const [loadingClients, setLoadingClients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'VIEWER') {
      router.replace('/invoices');
    }
  }, [role, router]);

  useEffect(() => {
    async function loadClients() {
      try {
        const res = await getClientsApi({ limit: 100, status: 'active' });
        setClients(res.clients);
        if (!clientId && res.clients.length > 0) {
          setClientId(res.clients[0].id);
          setPlaceOfSupply(res.clients[0].stateCode);
        }
      } catch {
        // ignore
      } finally {
        setLoadingClients(false);
      }
    }
    loadClients();
  }, []);

  const handleClientChange = (cId: string) => {
    setClientId(cId);
    const selected = clients.find((c) => c.id === cId);
    if (selected) {
      setPlaceOfSupply(selected.stateCode);
    }
  };

  const handleItemChange = (index: number, field: keyof LineItemForm, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        description: '',
        sacCode: '',
        quantity: '1',
        rate: '0.00',
        discountAmount: '0.00',
        gstRate: '18.00',
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError('Please select a client.');
      return;
    }

    if (items.some((it) => !it.description.trim())) {
      setError('All line items must have a valid description.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        clientId,
        invoiceDate,
        dueDate: dueDate || undefined,
        placeOfSupplyStateCode: placeOfSupply || undefined,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
        items: items.map((it) => ({
          description: it.description.trim(),
          sacCode: it.sacCode.trim() || undefined,
          quantity: it.quantity,
          rate: it.rate,
          discountAmount: it.discountAmount || '0.00',
          gstRate: it.gstRate,
        })),
      };

      const { invoice } = await createInvoiceApi(payload);
      router.push(`/invoices/${invoice.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Validation error while creating invoice draft');
      } else {
        setError('Failed to create invoice.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader
        title="Create Invoice Draft"
        subtitle="Prepare line items and tax breakdown for client invoice."
      />

      <main className="page-wrapper" style={{ maxWidth: '1100px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
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

        <form onSubmit={handleSubmit}>
          {/* Invoice Particulars Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Invoice Details</h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="clientSelect">
                  Client *
                </label>
                <select
                  id="clientSelect"
                  className="form-select"
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  disabled={loadingClients}
                  required
                >
                  {loadingClients ? (
                    <option>Loading clients...</option>
                  ) : (
                    clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.state})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="invoiceDate">
                  Invoice Date *
                </label>
                <input
                  id="invoiceDate"
                  type="date"
                  className="form-input"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="dueDate">
                  Due Date
                </label>
                <input
                  id="dueDate"
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="placeOfSupply">
                  Place of Supply (State Code)
                </label>
                <input
                  id="placeOfSupply"
                  type="text"
                  maxLength={2}
                  className="form-input"
                  placeholder="e.g. 27"
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Line Items & GST</h3>
              <button type="button" onClick={addItem} className="btn btn-secondary btn-sm">
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 1fr 1fr 1.5fr 1fr 1.5fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Description *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Service / Product Description"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      SAC / HSN
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="998311"
                      value={item.sacCode}
                      onChange={(e) => handleItemChange(index, 'sacCode', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Qty</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Unit Rate (₹)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="0.00"
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Discount (₹)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="0.00"
                      value={item.discountAmount}
                      onChange={(e) => handleItemChange(index, 'discountAmount', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      GST Rate
                    </label>
                    <select
                      className="form-select"
                      value={item.gstRate}
                      onChange={(e) => handleItemChange(index, 'gstRate', e.target.value)}
                    >
                      <option value="0.00">0% (Exempt)</option>
                      <option value="5.00">5%</option>
                      <option value="12.00">12%</option>
                      <option value="18.00">18% (Standard)</option>
                      <option value="28.00">28%</option>
                    </select>
                  </div>

                  <div style={{ paddingTop: '1.2rem' }}>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      disabled={items.length <= 1}
                      title="Remove Item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '1rem',
              }}
            >
              Note: Taxable amounts, CGST/SGST/IGST breakdowns and totals are calculated
              authoritatively by the backend ledger engine upon saving.
            </p>
          </div>

          {/* Notes & Terms */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="notes">
                  Notes for Client
                </label>
                <textarea
                  id="notes"
                  className="form-textarea"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="terms">
                  Terms & Conditions
                </label>
                <textarea
                  id="terms"
                  className="form-textarea"
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <Link href="/invoices" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
              <Save size={18} />
              <span>{isSubmitting ? 'Saving Draft...' : 'Save Draft Invoice'}</span>
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
