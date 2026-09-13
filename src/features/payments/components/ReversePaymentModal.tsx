import * as React from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { paymentsApi } from '../api/payments.api';

interface ReversePaymentModalProps {
  invoiceId: string;
  paymentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReversePaymentModal({ invoiceId, paymentId, onClose, onSuccess }: ReversePaymentModalProps) {
  const [reversalReason, setReversalReason] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalReason.trim()) {
      setError('Please provide a reason for reversal.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      await paymentsApi.reversePayment(invoiceId, paymentId, { reversalReason });
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to reverse payment');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-red-700">Reverse Payment</h2>
          <button onClick={onClose} className="text-red-400 hover:text-red-600">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            Are you sure you want to reverse this payment? This action will restore the outstanding balance of the invoice.
          </p>

          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium">Reversal Reason</label>
            <Input 
              type="text" 
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="e.g. Wrong amount entered"
              required
            />
          </div>

          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" isLoading={isLoading}>
              Reverse Payment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
