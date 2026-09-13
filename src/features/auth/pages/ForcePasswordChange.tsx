import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { Button } from '../../../components/ui/button';

export function ForcePasswordChange() {
  const { reloadUser, logout } = useAuth();
  
  const handleSuccess = async () => {
    // Reload user to clear the mustChangePassword state, which will trigger Redirect to dashboard
    await reloadUser();
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            Action Required
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            You must change your password before continuing.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm isForced={true} onSuccess={handleSuccess} />
            <div className="mt-6 text-center">
              <Button variant="ghost" onClick={logout} className="text-sm">
                Cancel and Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
