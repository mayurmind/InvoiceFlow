import * as React from 'react';
import { Button } from '../../../components/ui/button';
import { AlertCircle, X } from 'lucide-react';
import { usersApi } from '../api/users.api';
import type { ManagedUser, UserRole } from '../types/user.types';

interface UserRoleModalProps {
  user: ManagedUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserRoleModal({ user, onClose, onSuccess }: UserRoleModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newRole, setNewRole] = React.useState<UserRole | ''>('');

  React.useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewRole(user.role);
       
      setError(null);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newRole) return;
    
    if (newRole === user.role) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await usersApi.updateUserRole(user.id, newRole as UserRole);
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to update user role');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-0">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-[425px] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Change User Role</h2>
            <p className="text-sm text-muted-foreground mt-1">Update the role for {user.firstName} {user.lastName}.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form id="change-role-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Current Role</label>
              <div className="text-sm font-medium bg-muted p-2 rounded-md">{user.role}</div>
            </div>
            
            <div className="space-y-1">
              <label htmlFor="newRole" className="text-sm font-medium">New Role</label>
              <select
                id="newRole"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
                disabled={loading}
              >
                <option value="STAFF">Staff</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
          </form>
        </div>

        <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="change-role-form" disabled={loading || newRole === user.role}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
