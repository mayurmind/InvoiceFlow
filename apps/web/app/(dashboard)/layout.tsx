'use client';

import React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { AppSidebar } from '@/components/layout/AppSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading || !isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
        }}
      >
        <div
          className="animate-spin"
          style={{
            width: 36,
            height: 36,
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <AppSidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}
