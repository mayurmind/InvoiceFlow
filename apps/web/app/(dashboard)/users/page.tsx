'use client';

import React, { useEffect, useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  getUsersApi,
  createUserApi,
  updateUserRoleApi,
  updateUserStatusApi,
  resetUserPasswordApi,
  UserAccount,
} from '@/lib/api/users';
import { useAuth } from '@/features/auth/AuthContext';
import { formatDate } from '@/lib/formatters';
import { UserPlus, ShieldAlert, KeyRound, Check, X, AlertCircle } from 'lucide-react';

export default function UsersPage() {
  const { role, user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'STAFF' as 'STAFF' | 'VIEWER',
    temporaryPassword: '',
  });

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUsersApi({ limit: 50 });
      setUsers(res.users);
      setTotal(res.pagination.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'SUPER_ADMIN') {
      fetchUsers();
    }
  }, [role]);

  if (role !== 'SUPER_ADMIN') {
    return (
      <>
        <AppHeader title="Access Restricted" />
        <main className="page-wrapper" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '1rem',
              borderRadius: '50%',
              backgroundColor: 'var(--danger-subtle)',
              color: 'var(--danger)',
              marginBottom: '1rem',
            }}
          >
            <ShieldAlert size={36} />
          </div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Super Admin Access Required
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              marginTop: '0.5rem',
            }}
          >
            You do not have administrative privileges to manage user accounts.
          </p>
        </main>
      </>
    );
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await createUserApi(createForm);
      setIsCreateOpen(false);
      setCreateForm({
        email: '',
        firstName: '',
        lastName: '',
        role: 'STAFF',
        temporaryPassword: '',
      });
      setSuccessMessage('New user account provisioned successfully.');
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'STAFF' | 'VIEWER') => {
    setError(null);
    try {
      await updateUserRoleApi(userId, newRole);
      setSuccessMessage('User role updated.');
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update user role');
    }
  };

  const handleStatusToggle = async (targetUser: UserAccount) => {
    const nextStatus = !targetUser.isActive;
    const action = nextStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} ${targetUser.email}?`)) return;

    setError(null);
    try {
      await updateUserStatusApi(targetUser.id, nextStatus);
      setSuccessMessage(`User account ${action}d successfully.`);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} user`);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (resetPassword.length < 15) {
      setError('Temporary password must be at least 15 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await resetUserPasswordApi(selectedUser.id, resetPassword);
      setIsResetOpen(false);
      setSelectedUser(null);
      setResetPassword('');
      setSuccessMessage('Temporary password set. User will be prompted to change upon next login.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader
        title="User Administration"
        subtitle="Provision user roles, rotate credentials, and manage team access."
      />

      <main className="page-wrapper">
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
              Team Members ({total})
            </h2>
          </div>
          <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
            <UserPlus size={16} />
            <span>Provision User</span>
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--danger-subtle)',
              color: 'var(--danger)',
              borderRadius: '8px',
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
              color: 'var(--success)',
              borderRadius: '8px',
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

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created Date</th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>
                      {u.firstName} {u.lastName}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      {u.role === 'SUPER_ADMIN' ? (
                        <span className="badge badge-super-admin">SUPER_ADMIN</span>
                      ) : (
                        <select
                          className="form-select"
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value as 'STAFF' | 'VIEWER')
                          }
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            width: 'auto',
                          }}
                        >
                          <option value="STAFF">STAFF</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {u.isActive ? (
                        <span className="badge badge-active">ACTIVE</span>
                      ) : (
                        <span className="badge badge-inactive">SUSPENDED</span>
                      )}
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.5rem',
                        }}
                      >
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setIsResetOpen(true);
                          }}
                          className="btn btn-secondary btn-sm"
                          title="Reset Password"
                        >
                          <KeyRound size={14} />
                          <span>Reset Password</span>
                        </button>

                        {u.role !== 'SUPER_ADMIN' && u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleStatusToggle(u)}
                            className={`btn btn-sm ${u.isActive ? 'btn-ghost' : 'btn-secondary'}`}
                            style={{ color: u.isActive ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
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

      {/* Provision User Modal */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Provision User Account</h2>
              <button onClick={() => setIsCreateOpen(false)} className="btn btn-ghost btn-sm">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="u-fname">
                    First Name *
                  </label>
                  <input
                    id="u-fname"
                    type="text"
                    className="form-input"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="u-lname">
                    Last Name *
                  </label>
                  <input
                    id="u-lname"
                    type="text"
                    className="form-input"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="u-email">
                  Email Address *
                </label>
                <input
                  id="u-email"
                  type="email"
                  className="form-input"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="u-role">
                  Role *
                </label>
                <select
                  id="u-role"
                  className="form-select"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      role: e.target.value as 'STAFF' | 'VIEWER',
                    })
                  }
                >
                  <option value="STAFF">STAFF (Manage Clients & Invoices)</option>
                  <option value="VIEWER">VIEWER (Read Only)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="u-tempPass">
                  Temporary Password (Min 15 chars) *
                </label>
                <input
                  id="u-tempPass"
                  type="password"
                  className="form-input"
                  placeholder="Min 15 characters"
                  value={createForm.temporaryPassword}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, temporaryPassword: e.target.value })
                  }
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || createForm.temporaryPassword.length < 15}
                >
                  {isSubmitting ? 'Provisioning...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => setIsResetOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Reset Password for {selectedUser.firstName}
              </h2>
              <button onClick={() => setIsResetOpen(false)} className="btn btn-ghost btn-sm">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="u-resetPass">
                  New Temporary Password (Min 15 chars) *
                </label>
                <input
                  id="u-resetPass"
                  type="password"
                  className="form-input"
                  placeholder="Min 15 characters"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || resetPassword.length < 15}
                >
                  {isSubmitting ? 'Resetting...' : 'Set Temporary Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
