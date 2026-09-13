import * as React from 'react';
import { authApi } from '../api/auth.api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Alert } from '../../../components/ui/alert';

interface ChangePasswordFormProps {
  isForced?: boolean;
  onSuccess?: () => void;
}

export function ChangePasswordForm({ isForced = false, onSuccess }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.changePassword({
        currentPassword: isForced ? undefined : currentPassword,
        newPassword
      });
      
      setSuccessMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      {successMessage && <Alert variant="default" className="border-green-500 text-green-700 bg-green-50">{successMessage}</Alert>}

      {!isForced && (
        <div className="space-y-2">
          <label htmlFor="currentPassword" className="text-sm font-medium text-slate-700">
            Current Password
          </label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={isSubmitting}
            placeholder="Enter current password"
          />
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="newPassword" className="text-sm font-medium text-slate-700">
          New Password
        </label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          disabled={isSubmitting}
          placeholder="Enter new password"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
          Confirm New Password
        </label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isSubmitting}
          placeholder="Confirm new password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Changing password...' : 'Change Password'}
      </Button>
    </form>
  );
}
