'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  getClientsApi,
  createClientApi,
  updateClientApi,
  deactivateClientApi,
  Client,
} from '@/lib/api/clients';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api/client';
import { UserPlus, Search, Mail, Phone, ChevronRight, X } from 'lucide-react';

export default function ClientsPage() {
  const { role } = useAuth();
  const isReadOnly = role === 'VIEWER';

  const [clients, setClients] = useState<Client[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [modalForm, setModalForm] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    pan: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    stateCode: '',
    postalCode: '',
    country: 'India' as const,
    notes: '',
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getClientsApi({
        page,
        limit: 15,
        search: search.trim() || undefined,
        status,
      });
      setClients(res.clients);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load client directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [page, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchClients();
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedClient(null);
    setModalForm({
      name: '',
      email: '',
      phone: '',
      gstin: '',
      pan: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: 'Maharashtra',
      stateCode: '27',
      postalCode: '',
      country: 'India',
      notes: '',
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setModalMode('edit');
    setSelectedClient(client);
    setModalForm({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      gstin: client.gstin || '',
      pan: client.pan || '',
      addressLine1: client.addressLine1,
      addressLine2: client.addressLine2 || '',
      city: client.city,
      state: client.state,
      stateCode: client.stateCode,
      postalCode: client.postalCode,
      country: client.country || 'India',
      notes: client.notes || '',
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name: modalForm.name.trim(),
        email: modalForm.email.trim() || null,
        phone: modalForm.phone.trim() || null,
        gstin: modalForm.gstin.trim() || null,
        pan: modalForm.pan.trim() || null,
        addressLine1: modalForm.addressLine1.trim(),
        addressLine2: modalForm.addressLine2.trim() || null,
        city: modalForm.city.trim(),
        state: modalForm.state.trim(),
        stateCode: modalForm.stateCode.trim(),
        postalCode: modalForm.postalCode.trim(),
        country: modalForm.country,
        notes: modalForm.notes.trim() || null,
      };

      if (modalMode === 'create') {
        await createClientApi(payload);
      } else if (selectedClient) {
        await updateClientApi(selectedClient.id, payload);
      }
      setIsModalOpen(false);
      fetchClients();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setModalError(err.message || 'Validation error saving client');
      } else {
        setModalError('Failed to save client');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (client: Client) => {
    if (confirm(`Are you sure you want to deactivate ${client.name}?`)) {
      try {
        await deactivateClientApi(client.id);
        fetchClients();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Failed to deactivate client');
      }
    }
  };

  return (
    <>
      <AppHeader
        title="Client Directory"
        subtitle="Manage enterprise clients, customer locations, and GST details."
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
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flex: 1,
              maxWidth: '400px',
            }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Search by client name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary">
              Search
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <select
              className="form-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as 'active' | 'archived' | 'all');
                setPage(1);
              }}
              style={{ width: '140px' }}
            >
              <option value="active">Active Only</option>
              <option value="archived">Archived Only</option>
              <option value="all">All Clients</option>
            </select>

            {!isReadOnly && (
              <button onClick={openCreateModal} className="btn btn-primary">
                <UserPlus size={16} />
                <span>New Client</span>
              </button>
            )}
          </div>
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

        {/* Clients Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Contact</th>
                <th>Location / State</th>
                <th>GSTIN / PAN</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 0' }}>
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
              ) : clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}
                  >
                    No clients found matching the query.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/clients/${c.id}`}
                        style={{
                          fontWeight: 600,
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        <span>{c.name}</span>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {c.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Mail size={12} /> {c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              marginTop: '2px',
                            }}
                          >
                            <Phone size={12} /> {c.phone}
                          </div>
                        )}
                        {!c.email && !c.phone && '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {c.city}, {c.state}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Code: {c.stateCode}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {c.gstin ? (
                          <span style={{ color: 'var(--info)' }}>{c.gstin}</span>
                        ) : c.pan ? (
                          <span>PAN: {c.pan}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Unregistered</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {c.status === 'ACTIVE' ? (
                        <span className="badge badge-active">ACTIVE</span>
                      ) : (
                        <span className="badge badge-inactive">ARCHIVED</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.5rem',
                        }}
                      >
                        <Link href={`/clients/${c.id}`} className="btn btn-ghost btn-sm">
                          View
                        </Link>
                        {!isReadOnly && c.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => openEditModal(c)}
                              className="btn btn-secondary btn-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeactivate(c)}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)' }}
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal for Create / Edit Client */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {modalMode === 'create'
                  ? 'Create New Client'
                  : `Edit Client: ${selectedClient?.name}`}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-ghost btn-sm">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--danger-subtle)',
                  color: 'var(--danger)',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleModalSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="m-name">
                  Client Name *
                </label>
                <input
                  id="m-name"
                  type="text"
                  className="form-input"
                  value={modalForm.name}
                  onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="m-email">
                    Email
                  </label>
                  <input
                    id="m-email"
                    type="email"
                    className="form-input"
                    value={modalForm.email}
                    onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="m-phone">
                    Phone
                  </label>
                  <input
                    id="m-phone"
                    type="text"
                    className="form-input"
                    value={modalForm.phone}
                    onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="m-gstin">
                    GSTIN (15 Chars)
                  </label>
                  <input
                    id="m-gstin"
                    type="text"
                    className="form-input"
                    maxLength={15}
                    placeholder="27ABCDE1234F1Z5"
                    value={modalForm.gstin}
                    onChange={(e) =>
                      setModalForm({ ...modalForm, gstin: e.target.value.toUpperCase() })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="m-pan">
                    PAN
                  </label>
                  <input
                    id="m-pan"
                    type="text"
                    className="form-input"
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={modalForm.pan}
                    onChange={(e) =>
                      setModalForm({ ...modalForm, pan: e.target.value.toUpperCase() })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-address1">
                  Address Line 1 *
                </label>
                <input
                  id="m-address1"
                  type="text"
                  className="form-input"
                  value={modalForm.addressLine1}
                  onChange={(e) => setModalForm({ ...modalForm, addressLine1: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="m-city">
                    City *
                  </label>
                  <input
                    id="m-city"
                    type="text"
                    className="form-input"
                    value={modalForm.city}
                    onChange={(e) => setModalForm({ ...modalForm, city: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="m-state">
                    State *
                  </label>
                  <input
                    id="m-state"
                    type="text"
                    className="form-input"
                    value={modalForm.state}
                    onChange={(e) => setModalForm({ ...modalForm, state: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="m-stateCode">
                    State Code (2 digits) *
                  </label>
                  <input
                    id="m-stateCode"
                    type="text"
                    className="form-input"
                    maxLength={2}
                    value={modalForm.stateCode}
                    onChange={(e) => setModalForm({ ...modalForm, stateCode: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-pin">
                  PIN Code *
                </label>
                <input
                  id="m-pin"
                  type="text"
                  className="form-input"
                  maxLength={6}
                  value={modalForm.postalCode}
                  onChange={(e) => setModalForm({ ...modalForm, postalCode: e.target.value })}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Saving...'
                    : modalMode === 'create'
                      ? 'Create Client'
                      : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
