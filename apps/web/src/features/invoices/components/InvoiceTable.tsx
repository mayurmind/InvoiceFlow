import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import type { InvoiceListItemResponse, ClientResponse } from '../types/invoice.types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { InvoiceQuickActions } from './InvoiceQuickActions';
import { RecordPaymentModal } from '../../payments/components/RecordPaymentModal';
import { CancelInvoiceModal } from './CancelInvoiceModal';

interface InvoiceTableProps {
  invoices: InvoiceListItemResponse[];
  clientsMap: Record<string, ClientResponse>;
  /** Called when a mutation action succeeds. Parent should reload its data. */
  onInvoiceUpdated?: () => void;
}

type ModalState = {
  type: 'record_payment' | 'cancel';
  invoiceId: string;
  outstandingAmount: string;
} | null;

export function InvoiceTable({ invoices, clientsMap, onInvoiceUpdated }: InvoiceTableProps) {
  const navigate = useNavigate();
  const [modalState, setModalState] = React.useState<ModalState>(null);

  const handleActionIntent = (
    action: 'record_payment' | 'cancel',
    invoiceId: string,
    outstandingAmount: string,
  ) => {
    setModalState({ type: action, invoiceId, outstandingAmount });
  };

  const handleActionComplete = () => {
    setModalState(null);
    onInvoiceUpdated?.();
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice Number</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Invoice Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">
                {invoice.invoiceNumber || 'Draft'}
              </TableCell>
              <TableCell>
                {clientsMap[invoice.clientId]?.name || 'Unknown Client'}
              </TableCell>
              <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
              <TableCell>{formatDate(invoice.dueDate)}</TableCell>
              <TableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(invoice.total)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  >
                    View
                  </Button>
                  <InvoiceQuickActions
                    invoice={invoice}
                    onActionIntent={handleActionIntent}
                    onRefreshRequired={() => onInvoiceUpdated?.()}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Modals are hoisted to table level — one instance shared across all rows */}
      {modalState?.type === 'record_payment' && (
        <RecordPaymentModal
          invoiceId={modalState.invoiceId}
          outstandingAmount={modalState.outstandingAmount}
          onClose={() => setModalState(null)}
          onSuccess={handleActionComplete}
        />
      )}

      {modalState?.type === 'cancel' && (
        <CancelInvoiceModal
          invoiceId={modalState.invoiceId}
          onClose={() => setModalState(null)}
          onSuccess={handleActionComplete}
        />
      )}
    </div>
  );
}
