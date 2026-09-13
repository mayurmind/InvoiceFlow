
import { KeyRound, Shield, Ban, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import type { ManagedUser } from '../types/user.types';

interface UserTableProps {
  users: ManagedUser[];
  onEditRole: (user: ManagedUser) => void;
  onEditStatus: (user: ManagedUser) => void;
  onResetPassword: (user: ManagedUser) => void;
}

export function UserTable({ users, onEditRole, onEditStatus, onResetPassword }: UserTableProps) {
  return (
    <div className="rounded-md border border-border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    {user.email}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : user.role === 'STAFF' ? 'info' : 'neutral'}>
                    {user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    {user.isActive ? 'Active' : 'Inactive'}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onEditRole(user)}
                      title="Change Role"
                      disabled={user.role === 'SUPER_ADMIN'}
                    >
                      <Shield className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onResetPassword(user)}
                      title="Reset Password"
                    >
                      <KeyRound className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onEditStatus(user)}
                      title={user.isActive ? 'Deactivate User' : 'Activate User'}
                      disabled={user.role === 'SUPER_ADMIN'}
                    >
                      {user.isActive ? (
                        <Ban className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-muted-foreground hover:text-green-500" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
