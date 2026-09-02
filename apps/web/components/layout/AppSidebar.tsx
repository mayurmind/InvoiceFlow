'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { LayoutDashboard, FileText, Users, Building2, UserCog, ShieldCheck } from 'lucide-react';

export function AppSidebar() {
  const pathname = usePathname();
  const { user, role } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'STAFF', 'VIEWER'],
    },
    {
      label: 'Invoices',
      href: '/invoices',
      icon: FileText,
      roles: ['SUPER_ADMIN', 'STAFF', 'VIEWER'],
    },
    {
      label: 'Clients',
      href: '/clients',
      icon: Users,
      roles: ['SUPER_ADMIN', 'STAFF', 'VIEWER'],
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: Building2,
      roles: ['SUPER_ADMIN', 'STAFF', 'VIEWER'],
    },
    {
      label: 'User Management',
      href: '/users',
      icon: UserCog,
      roles: ['SUPER_ADMIN'],
    },
  ];

  const visibleNav = navItems.filter((item) => role && item.roles.includes(role));

  const getRoleBadgeClass = (r?: string | null) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'badge-super-admin';
      case 'STAFF':
        return 'badge-staff';
      case 'VIEWER':
      default:
        return 'badge-viewer';
    }
  };

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'var(--primary-subtle)',
            color: 'var(--primary)',
          }}
        >
          <ShieldCheck size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
            InvoiceFlow
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GST Billing Engine</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav
        style={{
          flex: 1,
          padding: '1rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 0.875rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--primary-subtle)' : 'transparent',
                border: isActive ? '1px solid var(--primary-border)' : '1px solid transparent',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon
                size={18}
                style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.375rem',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.name || user?.email}
          </div>
          <span className={`badge ${getRoleBadgeClass(role)}`} style={{ fontSize: '0.65rem' }}>
            {role || 'USER'}
          </span>
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user?.email}
        </div>
      </div>
    </aside>
  );
}
