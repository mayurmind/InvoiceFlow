import * as React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { BusinessSettingsForm } from '../components/BusinessSettingsForm';
import { apiClient } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/errors';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { Alert } from '../../../components/ui/alert';
import type { BusinessSettings, UpdateBusinessSettingsRequest } from '../types/business-settings.types';

export function BusinessSettingsPage() {
  const [settings, setSettings] = React.useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const data = await apiClient.get<BusinessSettings>('/business-settings');
        if (mounted) {
          setSettings(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof ApiError && err.status === 403) {
            setError('You do not have permission to view business settings.');
          } else {
            setError('Failed to load business settings. Please try again.');
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (formData: UpdateBusinessSettingsRequest) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Fetch CSRF token first
      const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
      
      // Submit changes
      const updatedData = await apiClient.put<BusinessSettings>('/business-settings', {
        body: formData,
        headers: {
          'x-csrf-token': csrfToken,
        }
      });
      
      setSettings(updatedData);
      setSubmitSuccess(true);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 5000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          const errorMessage = (err.data as Record<string, string>)?.message;
          setSubmitError(errorMessage || 'Invalid data submitted. Please check the form.');
        } else if (err.status === 403) {
          setSubmitError('You do not have permission to update business settings.');
        } else {
          setSubmitError('Failed to save business settings. Please try again.');
        }
      } else {
        setSubmitError('Unable to connect to InvoiceFlow. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Business Settings" description="Manage your organization profile and billing details." />
        <div className="space-y-4 max-w-4xl">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Business Settings" description="Manage your organization profile and billing details." />
        <ErrorState 
          title="Unable to load settings" 
          description={error || 'An unexpected error occurred.'} 
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Business Settings" 
        description="Manage your organization profile and billing details." 
      />
      
      <div className="max-w-4xl">
        {submitSuccess && (
          <Alert variant="success" className="mb-6">
            <p>Business settings saved successfully.</p>
          </Alert>
        )}
        
        {submitError && (
          <Alert variant="destructive" className="mb-6">
            <p>{submitError}</p>
          </Alert>
        )}

        <BusinessSettingsForm 
          initialData={settings}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
