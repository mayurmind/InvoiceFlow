import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Skeleton } from '../../../components/ui/skeleton';
import { apiClient } from '../../../lib/api/client';
import type { EmailDeliveryResponse } from '../types/email-delivery.types';
import { formatDate } from '../utils/formatters';

interface EmailDeliveryListProps {
  invoiceId: string;
  refreshTrigger: number;
}

export function EmailDeliveryList({ invoiceId, refreshTrigger }: EmailDeliveryListProps) {
  const [deliveries, setDeliveries] = React.useState<EmailDeliveryResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadDeliveries() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<EmailDeliveryResponse[]>(`/invoices/${invoiceId}/email-deliveries`);
        if (mounted) {
          setDeliveries(data);
        }
      } catch {
        if (mounted) {
          setError('Failed to load email delivery history.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadDeliveries();

    return () => {
      mounted = false;
    };
  }, [invoiceId, refreshTrigger]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email Deliveries</CardTitle>
      </CardHeader>
      <CardContent>
        {deliveries.length === 0 ? (
          <div className="text-sm text-muted-foreground">No email deliveries yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Attempted At</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      delivery.status === 'ACCEPTED' ? 'bg-success/10 text-success border-success/20' :
                      delivery.status === 'FAILED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                      'bg-warning/10 text-warning border-warning/20'
                    }`}>
                      {delivery.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{delivery.recipientEmail}</TableCell>
                  <TableCell className="text-sm">{formatDate(delivery.attemptedAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {delivery.status === 'FAILED' && delivery.failureMessage ? delivery.failureMessage : ''}
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
