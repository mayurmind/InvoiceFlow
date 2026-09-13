import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { Spinner } from '../ui/spinner';

export function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    // Redirect to login but save the intended location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Handle forced password change
  if (status === 'authenticated' && user?.mustChangePassword) {
    if (location.pathname !== '/force-password-change') {
      return <Navigate to="/force-password-change" replace />;
    }
  } else if (location.pathname === '/force-password-change') {
    // Prevent access to forced change if not needed
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
