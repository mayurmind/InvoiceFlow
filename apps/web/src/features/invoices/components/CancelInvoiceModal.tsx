import * as React from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { invoicesApi } from '../api/invoices.api';

interface CancelInvoiceModalProps {
  invoiceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelInvoiceModal({ invoiceId, onClose, onSuccess }: CancelInvoiceModalProps) {
  const [reason, setReason] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('A cancellation reason is required.');
      return;
    }

    setIsLoading(true);
    try {
      await invoicesApi.cancelInvoice(invoiceId, { reason: trimmedReason });
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to cancel invoice.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div 
        role="dialog" 
        aria-labelledby="cancel-invoice-title" 
        aria-modal="true"
        className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 id="cancel-invoice-title" className="text-lg font-semibold text-red-600">Cancel Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close modal">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Cancelling this invoice is a destructive action and cannot be undone. Please provide a reason for cancellation.
          </p>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm" role="alert">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="cancelReason" className="text-sm font-medium">Cancellation Reason *</label>
            <Input 
              id="cancelReason"
              type="text" 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Created by mistake, Duplicated"
              required
              disabled={isLoading}
            />
          </div>

          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Close
            </Button>
            <Button type="submit" variant="destructive" isLoading={isLoading}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
