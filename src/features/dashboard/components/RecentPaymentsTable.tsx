import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { PaymentStatus, PaymentMethod } from '../types/dashboard.types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface RecentPaymentsTableProps {
  payments: Array<{
    id: string;
    invoiceId: string;
    amount: string;
    method: PaymentMethod;
    status: PaymentStatus;
    paidAt: string;
  }>;
}

const getStatusBadgeVariant = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.COMPLETED:
      return 'success';
    case PaymentStatus.PENDING:
      return 'warning';
    case PaymentStatus.FAILED:
      return 'error';
    default:
      return 'default';
  }
};

export function RecentPaymentsTable({ payments }: RecentPaymentsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Payments</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-md">
            No recent payments found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.paidAt)}</TableCell>
                  <TableCell>{payment.method.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(payment.status)}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    +{formatCurrency(payment.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
