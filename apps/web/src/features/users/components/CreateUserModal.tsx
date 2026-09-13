import * as React from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Copy, RefreshCw, AlertCircle, X } from 'lucide-react';
import { usersApi } from '../api/users.api';
import type { UserRole } from '../types/user.types';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [role, setRole] = React.useState<UserRole | ''>('');
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
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail('');
       
      setFirstName('');
       
      setLastName('');
       
      setRole('');
       
      generatePassword();
       
      setError(null);
    }
  }, [isOpen, generatePassword]);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !firstName || !lastName || !role || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 15) {
      setError('Password must be at least 15 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await usersApi.createUser({
        email,
        firstName,
        lastName,
        role,
        temporaryPassword: password,
      });
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-0">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-[425px] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Create New User</h2>
            <p className="text-sm text-muted-foreground mt-1">Add a new user to the system.</p>
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

          <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                maxLength={320}
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="firstName" className="text-sm font-medium">First Name</label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={100}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="lastName" className="text-sm font-medium">Last Name</label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={100}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="role" className="text-sm font-medium">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
                disabled={loading}
              >
                <option value="" disabled>Select a role...</option>
                <option value="STAFF">Staff</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Temporary Password</label>
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
                Please copy and securely share this password.
              </p>
            </div>
          </form>
        </div>

        <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" disabled={loading}>
            {loading ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </div>
    </div>
  );
}
