import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';

interface RoleProtectedRouteProps {
  allowedRoles: string[];
  children?: React.ReactNode;
}

export function RoleProtectedRoute({ allowedRoles, children }: RoleProtectedRouteProps) {
  const { user, status } = useAuth();

  if (status === 'initializing' || status === 'unauthenticated') {
    // Rely on the parent ProtectedRoute to handle unauthenticated
    return children ? <>{children}</> : <Outlet />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
