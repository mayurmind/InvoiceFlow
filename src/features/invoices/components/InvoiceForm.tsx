import * as React from 'react';
import type { InvoiceCreatePayload, InvoiceDetailResponse } from '../types/invoice.types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ClientCombobox } from '../../clients/components/ClientCombobox';

interface InvoiceFormProps {
  initialData?: InvoiceDetailResponse;
  onSubmit: (data: InvoiceCreatePayload, issueImmediately?: boolean) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}

export function InvoiceForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
}: InvoiceFormProps) {
  const [clientId, setClientId] = React.useState(initialData?.clientId || '');
  
  // Format today's date safely
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const [invoiceDate, setInvoiceDate] = React.useState(initialData?.invoiceDate || todayStr);
  const [dueDate, setDueDate] = React.useState(initialData?.dueDate || '');
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = React.useState(initialData?.placeOfSupplyStateCode || '');
  const [notes, setNotes] = React.useState(initialData?.notes || '');
  const [terms, setTerms] = React.useState(initialData?.terms || '');

  const [items, setItems] = React.useState<InvoiceCreatePayload['items']>(
    initialData?.items.map(item => ({
      description: item.description,
      sacCode: item.sacCode || '',
      quantity: item.quantity,
      rate: item.rate,
      discountAmount: item.discountAmount,
      gstRate: item.gstRate,
    })) || [
      { description: '', sacCode: '', quantity: '1.000', rate: '0.00', discountAmount: '0.00', gstRate: '18.00' }
    ]
  );

  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    // Determine which button was clicked
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const issueIntended = submitter?.value === 'issue';

    if (!clientId) {
      setError('Please select a client.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one line item.');
      return;
    }

    try {
      await onSubmit({
        clientId,
        invoiceDate,
        dueDate: dueDate || undefined,
        placeOfSupplyStateCode: placeOfSupplyStateCode || undefined,
        notes: notes || null,
        terms: terms || null,
        items: items.map(item => ({
          ...item,
          sacCode: item.sacCode || null,
        })),
      }, issueIntended);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Validation failed. Please check your inputs.');
      } else {
        setError('Validation failed. Please check your inputs.');
      }
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', sacCode: '', quantity: '1.000', rate: '0.00', discountAmount: '0.00', gstRate: '18.00' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceCreatePayload['items'][0], value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Preview calculations (UI only, backend is authoritative)
  const calculatePreview = () => {
    let subtotalCents = 0;
    let discountTotalCents = 0;
    let igstTotalCents = 0;

    items.forEach(item => {
      // Safe integer math for preview
      // Quantity has up to 3 decimals, Rate has up to 2.
      // E.g., 1.000 * 1000 = 1000, 10.50 * 100 = 1050
      const qNum = Math.round(parseFloat(item.quantity || '0') * 1000);
      const rNum = Math.round(parseFloat(item.rate || '0') * 100);
      const dNum = Math.round(parseFloat(item.discountAmount || '0') * 100);
      const gNum = Math.round(parseFloat(item.gstRate || '0') * 100);

      // qNum (x1000) * rNum (x100) = baseAmount (x100000)
      // To get cents (x100), divide by 1000
      const baseAmountCents = Math.round((qNum * rNum) / 1000);
      
      const taxableCents = Math.max(0, baseAmountCents - dNum);
      
      // taxable (x100) * gNum (x100) = tax (x10000)
      // To get cents, divide by 100
      const taxCents = Math.round((taxableCents * gNum) / 100);

      subtotalCents += baseAmountCents;
      discountTotalCents += dNum;
      igstTotalCents += taxCents;
    });

    const taxableTotalCents = Math.max(0, subtotalCents - discountTotalCents);
    const totalCents = taxableTotalCents + igstTotalCents;

    return {
      subtotal: (subtotalCents / 100).toFixed(2),
      discountTotal: (discountTotalCents / 100).toFixed(2),
      taxableTotal: (taxableTotalCents / 100).toFixed(2),
      taxTotal: (igstTotalCents / 100).toFixed(2),
      total: (totalCents / 100).toFixed(2)
    };
  };

  const preview = calculatePreview();

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="clientId" className="text-sm font-medium">Client *</label>
          <ClientCombobox
            value={clientId}
            onChange={setClientId}
            disabled={isSubmitting}
            placeholder="Select a client"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="placeOfSupply" className="text-sm font-medium">Place of Supply State Code</label>
          <Input 
            id="placeOfSupply"
            value={placeOfSupplyStateCode} 
            onChange={e => setPlaceOfSupplyStateCode(e.target.value)} 
            placeholder="e.g. 29"
            maxLength={2}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="invoiceDate" className="text-sm font-medium">Invoice Date *</label>
          <Input 
            id="invoiceDate"
            type="date" 
            required 
            value={invoiceDate} 
            onChange={e => setInvoiceDate(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="dueDate" className="text-sm font-medium">Due Date</label>
          <Input 
            id="dueDate"
            type="date" 
            value={dueDate} 
            onChange={e => setDueDate(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Line Items *</h3>
          <Button type="button" variant="outline" onClick={addItem} disabled={isSubmitting}>
            Add Item
          </Button>
        </div>
        
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 w-24">SAC</th>
                <th className="px-4 py-2 w-24">Qty</th>
                <th className="px-4 py-2 w-32">Rate</th>
                <th className="px-4 py-2 w-32">Discount</th>
                <th className="px-4 py-2 w-24">GST %</th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">
                    <Input 
                      required 
                      value={item.description} 
                      onChange={e => updateItem(index, 'description', e.target.value)} 
                      placeholder="Item description"
                      disabled={isSubmitting}
                    />
                  </td>
                  <td className="p-2">
                    <Input 
                      value={item.sacCode || ''} 
                      onChange={e => updateItem(index, 'sacCode', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </td>
                  <td className="p-2">
                    <Input 
                      required 
                      type="number" 
                      step="0.001" 
                      min="0.001"
                      value={item.quantity} 
                      onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value || '0').toFixed(3))}
                      onBlur={e => updateItem(index, 'quantity', parseFloat(e.target.value || '0').toFixed(3))}
                      disabled={isSubmitting}
                    />
                  </td>
                  <td className="p-2">
                    <Input 
                      required 
                      type="number" 
                      step="0.01" 
                      min="0"
                      value={item.rate} 
                      onChange={e => updateItem(index, 'rate', parseFloat(e.target.value || '0').toFixed(2))}
                      onBlur={e => updateItem(index, 'rate', parseFloat(e.target.value || '0').toFixed(2))}
                      disabled={isSubmitting}
                    />
                  </td>
                  <td className="p-2">
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      value={item.discountAmount || '0.00'} 
                      onChange={e => updateItem(index, 'discountAmount', parseFloat(e.target.value || '0').toFixed(2))}
                      onBlur={e => updateItem(index, 'discountAmount', parseFloat(e.target.value || '0').toFixed(2))}
                      disabled={isSubmitting}
                    />
                  </td>
                  <td className="p-2">
                    <Input 
                      required 
                      type="number" 
                      step="0.01" 
                      min="0"
                      max="100"
                      value={item.gstRate} 
                      onChange={e => updateItem(index, 'gstRate', parseFloat(e.target.value || '0').toFixed(2))}
                      onBlur={e => updateItem(index, 'gstRate', parseFloat(e.target.value || '0').toFixed(2))}
                      disabled={isSubmitting}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeItem(index)}
                      disabled={isSubmitting || items.length === 1}
                    >
                      ✕
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{preview.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount:</span>
            <span>-{preview.discountTotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax (Preview):</span>
            <span>{preview.taxTotal}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Total:</span>
            <span>{preview.total}</span>
          </div>
          <p className="text-xs text-muted-foreground text-right italic">
            * Final calculation done by server
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <textarea 
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Terms & Conditions</label>
          <textarea 
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={terms}
            onChange={e => setTerms(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          name="intent"
          value="save"
          variant="secondary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
        <Button 
          type="submit" 
          name="intent"
          value="issue"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving & Issuing...' : 'Save & Issue'}
        </Button>
      </div>
    </form>
  );
}
