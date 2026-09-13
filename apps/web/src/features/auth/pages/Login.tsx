import * as React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';
import type { User } from '../types/auth.types';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, login } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const from = location.state?.from?.pathname || '/dashboard';

  // If already authenticated, redirect to destination
  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await apiClient.post<{ user: User }>('/auth/login', {
        body: { email, password }
      });
      
      login(data.user);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 400) {
          setError('Invalid email or password.');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Unable to connect to InvoiceFlow. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-primary">
            InvoiceFlow
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to sign in
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <p>{error}</p>
              </Alert>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                required
              />
            </div>
            <Button className="w-full" type="submit" isLoading={isSubmitting}>
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
