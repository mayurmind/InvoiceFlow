import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, Users as UsersIcon } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { EmptyState } from '../../../components/ui/empty-state';
import { usersApi } from '../api/users.api';
import { UserFilters } from '../components/UserFilters';
import type { UserFiltersState } from '../components/UserFilters';
import { UserTable } from '../components/UserTable';
import { CreateUserModal } from '../components/CreateUserModal';
import { UserRoleModal } from '../components/UserRoleModal';
import { UserStatusModal } from '../components/UserStatusModal';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import type { ListUsersResponse, ManagedUser, UserRole } from '../types/user.types';

export function UsersList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = React.useState<ListUsersResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [roleUser, setRoleUser] = React.useState<ManagedUser | null>(null);
  const [statusUser, setStatusUser] = React.useState<ManagedUser | null>(null);
  const [passwordUser, setPasswordUser] = React.useState<ManagedUser | null>(null);

  const filters: UserFiltersState = {
    role: (searchParams.get('role') as UserRole) || '',
    isActive: searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : '',
  };

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const handleFilterChange = (newFilters: UserFiltersState) => {
    const params = new URLSearchParams(searchParams);
    
    if (newFilters.role) params.set('role', newFilters.role);
    else params.delete('role');
    
    if (newFilters.isActive !== '') params.set('isActive', newFilters.isActive.toString());
    else params.delete('isActive');
    
    // Reset to page 1 on filter change
    params.set('page', '1');
    
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const fetchUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const offset = (page - 1) * limit;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = {
        offset,
        limit,
      };

      if (filters.role) params.role = filters.role;
      if (filters.isActive !== '') params.isActive = filters.isActive;

      const response = await usersApi.listUsers(params);
      setData(response);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while loading users.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters.role, filters.isActive]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const handleActionSuccess = () => {
    setRoleUser(null);
    setStatusUser(null);
    setPasswordUser(null);
    setIsCreateModalOpen(false);
    fetchUsers(); // Refresh list
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage system users, roles, and access."
        actions={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            New User
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <UserFilters filters={filters} onFilterChange={handleFilterChange} />

        {error ? (
          <ErrorState 
            title="Failed to load users"
            description={error}
            onRetry={fetchUsers}
          />
        ) : loading && !data ? (
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full rounded-md" />
          </div>
        ) : data && data.data.length > 0 ? (
          <div className="space-y-4">
            <UserTable 
              users={data.data} 
              onEditRole={setRoleUser}
              onEditStatus={setStatusUser}
              onResetPassword={setPasswordUser}
            />
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2 text-sm text-muted-foreground">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.pagination.total)} of {data.pagination.total} users
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!data.pagination.hasPreviousPage}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!data.pagination.hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No users found"
            description={
              filters.role || filters.isActive !== ''
                ? "We couldn't find any users matching your current filters. Try adjusting them."
                : "No users exist in the system yet."
            }
            icon={UsersIcon}
            actionLabel={!filters.role && filters.isActive === '' ? "New User" : undefined}
            onAction={!filters.role && filters.isActive === '' ? () => setIsCreateModalOpen(true) : undefined}
          />
        )}
      </div>

      <CreateUserModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={handleActionSuccess} 
      />
      <UserRoleModal 
        user={roleUser} 
        onClose={() => setRoleUser(null)} 
        onSuccess={handleActionSuccess} 
      />
      <UserStatusModal 
        user={statusUser} 
        onClose={() => setStatusUser(null)} 
        onSuccess={handleActionSuccess} 
      />
      <ResetPasswordModal 
        user={passwordUser} 
        onClose={() => setPasswordUser(null)} 
        onSuccess={handleActionSuccess} 
      />
    </div>
  );
}
