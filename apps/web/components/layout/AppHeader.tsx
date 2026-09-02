'use client';

import React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { LogOut } from 'lucide-react';

export function AppHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { logout, user } = useAuth();

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
      }}
    >
      <div>
        {title && (
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </h1>
        )}
        {subtitle && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {user?.name || user?.email}
          </span>
        </div>
        <button
          onClick={logout}
          className="btn btn-ghost btn-sm"
          title="Sign out"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
