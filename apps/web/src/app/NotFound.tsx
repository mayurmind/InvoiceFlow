import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface p-4 text-center">
      <div className="flex flex-col items-center max-w-md w-full space-y-6">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-secondary text-primary">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-primary">404</h1>
          <h2 className="text-xl font-semibold text-primary">Page not found</h2>
          <p className="text-muted-foreground">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')} size="lg">
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
