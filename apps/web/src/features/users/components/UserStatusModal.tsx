import * as React from 'react';
import { Button } from '../../../components/ui/button';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { usersApi } from '../api/users.api';
import type { ManagedUser } from '../types/user.types';

interface UserStatusModalProps {
  user: ManagedUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserStatusModal({ user, onClose, onSuccess }: UserStatusModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) setError(null);
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      await usersApi.updateUserStatus(user.id, !user.isActive);
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const action = user.isActive ? 'Deactivate' : 'Activate';
  const description = user.isActive 
    ? 'Deactivating this user will prevent them from logging in and accessing the system. You can reactivate them later.'
    : 'Activating this user will allow them to log in and access the system again.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-0">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-[425px] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{action} User</h2>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {user.isActive && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 text-amber-800 rounded-md border border-amber-200 mt-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Confirm Deactivation</p>
                <p className="mt-1">Are you sure you want to deactivate <strong>{user.firstName} {user.lastName}</strong>?</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant={user.isActive ? 'destructive' : 'default'} 
            onClick={handleSubmit} 
            disabled={loading}
          >
            {loading ? 'Processing...' : `Yes, ${action}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
