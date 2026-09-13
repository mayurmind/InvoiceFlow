/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPlaceholder } from '../features/dashboard/Dashboard';
import { InvoicesList } from '../features/invoices/pages/InvoicesList';
import { InvoiceDetail } from '../features/invoices/pages/InvoiceDetail';
import { InvoiceCreate } from '../features/invoices/pages/InvoiceCreate';
import { InvoiceEdit } from '../features/invoices/pages/InvoiceEdit';
import { ClientsList } from '../features/clients/pages/ClientsList';
import { ClientDetail } from '../features/clients/pages/ClientDetail';
import { ClientCreate } from '../features/clients/pages/ClientCreate';
import { ClientEdit } from '../features/clients/pages/ClientEdit';
import { NotFound } from './NotFound';
import { ErrorState } from '../components/ui/error-state';

import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { RoleProtectedRoute } from '../components/layout/RoleProtectedRoute';
import { Login } from '../features/auth/pages/Login';
import { BusinessSettingsPage } from '../features/business-settings/pages/BusinessSettings';
import { UsersList } from '../features/users/pages/UsersList';
import { AuditLogs } from '../features/audit/pages/AuditLogs';
import { ForcePasswordChange } from '../features/auth/pages/ForcePasswordChange';
import { SecuritySettings } from '../features/auth/pages/SecuritySettings';

function RouteErrorBoundary() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-surface p-4">
      <ErrorState 
        title="Application Error"
        description="Something went wrong while loading this page."
        onRetry={() => window.location.href = '/'}
        retryLabel="Go to Dashboard"
      />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'force-password-change',
        element: <ForcePasswordChange />,
      },
      {
        path: '/',
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: 'dashboard',
            element: <DashboardPlaceholder />,
          },
          {
            path: 'invoices',
            children: [
              {
                index: true,
                element: <InvoicesList />,
              },
              {
                path: 'new',
                element: (
                  <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'STAFF']}>
                    <InvoiceCreate />
                  </RoleProtectedRoute>
                ),
              },
              {
                path: ':invoiceId',
                element: <InvoiceDetail />,
              },
              {
                path: ':invoiceId/edit',
                element: (
                  <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'STAFF']}>
                    <InvoiceEdit />
                  </RoleProtectedRoute>
                ),
              }
            ]
          },
          {
            path: 'clients',
            children: [
              {
                index: true,
                element: <ClientsList />,
              },
              {
                path: 'new',
                element: <ClientCreate />,
              },
              {
                path: ':clientId',
                element: <ClientDetail />,
              },
              {
                path: ':clientId/edit',
                element: <ClientEdit />,
              }
            ]
          },
          {
            path: 'settings',
            children: [
              {
                index: true,
                element: <Navigate to="business" replace />,
              },
              {
                path: 'business',
                element: <BusinessSettingsPage />,
              },
              {
                path: 'users',
                element: <RoleProtectedRoute allowedRoles={['SUPER_ADMIN']} />,
                children: [
                  {
                    index: true,
                    element: <UsersList />,
                  }
                ]
              },
              {
                path: 'audit',
                element: <RoleProtectedRoute allowedRoles={['SUPER_ADMIN']} />,
                children: [
                  {
                    index: true,
                    element: <AuditLogs />,
                  }
                ]
              },
              {
                path: 'security',
                element: <SecuritySettings />,
              }
            ]
          },
          {
            path: '*',
            element: <NotFound />,
          }
        ]
      }
    ],
  },
]);
