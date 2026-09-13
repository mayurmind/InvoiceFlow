import * as React from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { paymentsApi } from '../api/payments.api';
import { PaymentMethod } from '../types/payments.types';

interface RecordPaymentModalProps {
  invoiceId: string;
  outstandingAmount: string;
  onClose: () => void;
  onSuccess: (paymentId: string) => void;
}

export function RecordPaymentModal({ invoiceId, outstandingAmount, onClose, onSuccess }: RecordPaymentModalProps) {
  const [amount, setAmount] = React.useState(outstandingAmount);
  const [method, setMethod] = React.useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [reference, setReference] = React.useState('');
  const [notes, setNotes] = React.useState('');
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const amountVal = parseFloat(amount);
    const outstandingVal = parseFloat(outstandingAmount);
    
    if (isNaN(amountVal) || amountVal <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (amountVal > outstandingVal) {
      setError(`Payment amount cannot exceed the outstanding balance of ${outstandingAmount}.`);
      return;
    }

    setIsLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const payment = await paymentsApi.recordPayment(invoiceId, {
        amount: amountVal.toFixed(2),
        method,
        reference: reference || undefined,
        notes: notes || undefined,
        idempotencyKey,
      });
      onSuccess(payment.id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to record payment');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <Input 
              type="number" 
              step="0.01" 
              min="0.01"
              max={outstandingAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Outstanding balance: {outstandingAmount}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <select 
              className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {Object.values(PaymentMethod).map((m) => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reference (Optional)</label>
            <Input 
              type="text" 
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TXN-123456"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <textarea 
              className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this payment"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Record Payment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
