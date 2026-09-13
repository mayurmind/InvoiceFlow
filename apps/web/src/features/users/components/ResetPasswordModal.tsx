import * as React from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Copy, RefreshCw, AlertCircle, X } from 'lucide-react';
import { usersApi } from '../api/users.api';
import type { ManagedUser } from '../types/user.types';

interface ResetPasswordModalProps {
  user: ManagedUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetPasswordModal({ user, onClose, onSuccess }: ResetPasswordModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [password, setPassword] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const generatePassword = React.useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
    const array = new Uint32Array(16);
    crypto.getRandomValues(array);
    let pwd = '';
    for (let i = 0; i < array.length; i++) {
      pwd += chars[array[i] % chars.length];
    }
    setPassword(pwd);
    setCopied(false);
  }, []);

  React.useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      generatePassword();
       
      setError(null);
    }
  }, [user, generatePassword]);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !password) return;
    
    if (password.length < 15) {
      setError('Password must be at least 15 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await usersApi.resetUserPassword(user.id, password);
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to reset user password');
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
            <h2 className="text-lg font-semibold">Reset Password</h2>
            <p className="text-sm text-muted-foreground mt-1">Generate a new temporary password for {user.firstName} {user.lastName}.</p>
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

          <form id="reset-password-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">New Temporary Password</label>
              <div className="flex gap-2">
                <Input
                  value={password}
                  readOnly
                  type="text"
                  className="font-mono text-sm"
                />
                <Button type="button" variant="outline" size="icon" onClick={generatePassword} title="Generate new password">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={handleCopy} title="Copy password">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {copied && <p className="text-xs text-green-600 mt-1">Copied to clipboard!</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Copy and securely share this password. The user will be forced to change it.
              </p>
            </div>
          </form>
        </div>

        <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="reset-password-form" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </div>
      </div>
    </div>
  );
}
