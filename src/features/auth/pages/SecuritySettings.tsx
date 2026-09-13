import * as React from 'react';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { Button } from '../../../components/ui/button';
import { LogOut } from 'lucide-react';

export function SecuritySettings() {
  const { logoutAll } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out of all active sessions? You will be logged out immediately.')) {
      return;
    }
    
    setIsLoggingOut(true);
    try {
      await logoutAll();
    } catch (error) {
      console.error(error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Security Settings" 
        description="Manage your account security and active sessions." 
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <p className="text-sm text-slate-500">
              Update your password to keep your account secure.
            </p>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm isForced={false} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Active Sessions</CardTitle>
            <p className="text-sm text-slate-500">
              Log out of all devices and active sessions.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              If you notice suspicious activity or simply want to ensure you are logged out everywhere, you can revoke all active sessions. You will be required to log in again.
            </p>
            <Button 
              variant="destructive" 
              onClick={handleLogoutAll} 
              disabled={isLoggingOut}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Logging out...' : 'Log out of all sessions'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
