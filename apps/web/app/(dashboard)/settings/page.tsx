'use client';

import React, { useEffect, useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  getBusinessSettingsApi,
  updateBusinessSettingsApi,
  BusinessSettings,
} from '@/lib/api/settings';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api/client';
import { Building, Landmark, Save, Check, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const { role } = useAuth();
  const isReadOnly = role === 'VIEWER';

  const [settings, setSettings] = useState<BusinessSettings>({
    legalName: '',
    displayName: '',
    gstin: '',
    pan: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    stateCode: '',
    postalCode: '',
    country: 'India',
    email: '',
    phone: '',
    invoicePrefix: 'INV',
    defaultDueDays: 15,
    bankAccountName: '',
    bankAccountNumber: '',
    bankName: '',
    bankIfsc: '',
    upiId: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      try {
        const res = await getBusinessSettingsApi();
        if (res.settings) {
          setSettings(res.settings);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load business settings');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleChange = (field: keyof BusinessSettings, value: string | number | null) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const res = await updateBusinessSettingsApi(settings);
      setSettings(res.settings);
      setSuccessMessage('Business settings updated successfully.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Validation error while updating business settings');
      } else {
        setError('Failed to update business settings.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppHeader
        title="Business Settings"
        subtitle="Configure legal entity information, GST details, bank accounts, and invoice defaults."
      />

      <main className="page-wrapper" style={{ maxWidth: '1000px' }}>
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

        {successMessage && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--success-subtle)',
              border: '1px solid var(--success-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--success)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Check size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="card skeleton" style={{ height: '400px' }} />
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Legal Entity & GST Section */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building size={20} color="var(--primary)" />
                  <h3 className="card-title">Legal Entity & GST Details</h3>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="legalName">
                    Legal Registered Name *
                  </label>
                  <input
                    id="legalName"
                    type="text"
                    className="form-input"
                    value={settings.legalName}
                    onChange={(e) => handleChange('legalName', e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="displayName">
                    Display / Brand Name *
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    className="form-input"
                    value={settings.displayName}
                    onChange={(e) => handleChange('displayName', e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="gstin">
                    GSTIN (15 Characters)
                  </label>
                  <input
                    id="gstin"
                    type="text"
                    className="form-input"
                    maxLength={15}
                    placeholder="27ABCDE1234F1Z5"
                    value={settings.gstin || ''}
                    onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pan">
                    Permanent Account Number (PAN)
                  </label>
                  <input
                    id="pan"
                    type="text"
                    className="form-input"
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={settings.pan || ''}
                    onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Address & Contact Section */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h3 className="card-title">Address & Location</h3>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="addressLine1">
                  Address Line 1 *
                </label>
                <input
                  id="addressLine1"
                  type="text"
                  className="form-input"
                  value={settings.addressLine1}
                  onChange={(e) => handleChange('addressLine1', e.target.value)}
                  disabled={isReadOnly}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="addressLine2">
                  Address Line 2
                </label>
                <input
                  id="addressLine2"
                  type="text"
                  className="form-input"
                  value={settings.addressLine2 || ''}
                  onChange={(e) => handleChange('addressLine2', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="city">
                    City *
                  </label>
                  <input
                    id="city"
                    type="text"
                    className="form-input"
                    value={settings.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="state">
                    State *
                  </label>
                  <input
                    id="state"
                    type="text"
                    className="form-input"
                    value={settings.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="stateCode">
                    State Code (2 digits) *
                  </label>
                  <input
                    id="stateCode"
                    type="text"
                    className="form-input"
                    maxLength={2}
                    placeholder="27"
                    value={settings.stateCode}
                    onChange={(e) => handleChange('stateCode', e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="postalCode">
                    PIN Code *
                  </label>
                  <input
                    id="postalCode"
                    type="text"
                    className="form-input"
                    maxLength={6}
                    placeholder="400001"
                    value={settings.postalCode}
                    onChange={(e) => handleChange('postalCode', e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Banking & Invoicing Defaults */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Landmark size={20} color="var(--primary)" />
                  <h3 className="card-title">Banking & Invoice Defaults</h3>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="invoicePrefix">
                    Invoice Prefix *
                  </label>
                  <input
                    id="invoicePrefix"
                    type="text"
                    className="form-input"
                    maxLength={5}
                    placeholder="INV"
                    value={settings.invoicePrefix}
                    onChange={(e) => handleChange('invoicePrefix', e.target.value.toUpperCase())}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="defaultDueDays">
                    Default Payment Due (Days) *
                  </label>
                  <input
                    id="defaultDueDays"
                    type="number"
                    min={0}
                    max={365}
                    className="form-input"
                    value={settings.defaultDueDays}
                    onChange={(e) =>
                      handleChange('defaultDueDays', parseInt(e.target.value, 10) || 0)
                    }
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bankName">
                    Bank Name
                  </label>
                  <input
                    id="bankName"
                    type="text"
                    className="form-input"
                    placeholder="HDFC Bank"
                    value={settings.bankName || ''}
                    onChange={(e) => handleChange('bankName', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bankAccountNumber">
                    Bank Account Number
                  </label>
                  <input
                    id="bankAccountNumber"
                    type="text"
                    className="form-input"
                    value={settings.bankAccountNumber || ''}
                    onChange={(e) => handleChange('bankAccountNumber', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bankIfsc">
                    IFSC Code
                  </label>
                  <input
                    id="bankIfsc"
                    type="text"
                    className="form-input"
                    placeholder="HDFC0001234"
                    value={settings.bankIfsc || ''}
                    onChange={(e) => handleChange('bankIfsc', e.target.value.toUpperCase())}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="upiId">
                    UPI ID / VPA
                  </label>
                  <input
                    id="upiId"
                    type="text"
                    className="form-input"
                    placeholder="billing@okbank"
                    value={settings.upiId || ''}
                    onChange={(e) => handleChange('upiId', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            {!isReadOnly && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '1rem',
                }}
              >
                <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                  <Save size={18} />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            )}
          </form>
        )}
      </main>
    </>
  );
}
