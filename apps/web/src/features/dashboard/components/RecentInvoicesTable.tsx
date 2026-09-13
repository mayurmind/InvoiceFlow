import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import type { InvoiceStatus } from '../types/dashboard.types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { InvoiceQuickActions } from '../../invoices/components/InvoiceQuickActions';
import { RecordPaymentModal } from '../../payments/components/RecordPaymentModal';
import { CancelInvoiceModal } from '../../invoices/components/CancelInvoiceModal';

// Dashboard recentInvoices shape. sentAt and outstandingAmount are not included
// in the summary response, so we provide safe defaults for QuickActions.
interface RecentInvoice {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  dueDate: string;
  clientName: string;
  total: string;
}

interface RecentInvoicesTableProps {
  invoices: RecentInvoice[];
  /** Called when a mutation action succeeds. Parent should reload its data. */
  onInvoiceUpdated?: () => void;
}

const getStatusBadgeVariant = (status: InvoiceStatus) => {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PARTIALLY_PAID':
      return 'warning';
    case 'DRAFT':
    case 'CANCELLED':
      return 'neutral';
    case 'SENT':
      return 'info';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: InvoiceStatus) => {
  if (status === 'PARTIALLY_PAID') return 'PARTIAL';
  return status;
};

type ModalState = {
  type: 'record_payment' | 'cancel';
  invoiceId: string;
  outstandingAmount: string;
} | null;

export function RecentInvoicesTable({ invoices, onInvoiceUpdated }: RecentInvoicesTableProps) {
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
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-md">
            No recent invoices found.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber || 'Draft'}
                    </TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status)}>
                        {getStatusLabel(invoice.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        >
                          View
                        </Button>
                        {/*
                         * Dashboard summary shape lacks sentAt and outstandingAmount.
                         * We pass sentAt=null (conservative: shows "Send Email" for emailable invoices)
                         * and use total as outstandingAmount (worst case — modal can re-validate).
                         */}
                        <InvoiceQuickActions
                          invoice={{
                            id: invoice.id,
                            // Dashboard InvoiceStatus is structurally identical to invoices InvoiceStatus.
                            // We cast via unknown to satisfy the different module const reference.
                            status: invoice.status as unknown as import('../../invoices/types/invoice.types').InvoiceStatus,
                            outstandingAmount: invoice.total,
                            sentAt: null,
                          }}
                          onActionIntent={handleActionIntent}
                          onRefreshRequired={() => onInvoiceUpdated?.()}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Modals hoisted to table level */}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
