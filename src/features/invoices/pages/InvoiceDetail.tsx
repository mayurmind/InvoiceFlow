import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { apiClient } from '../../../lib/api/client';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { Badge } from '../../../components/ui/badge';
import type { InvoiceDetailResponse, ClientResponse } from '../types/invoice.types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAuth } from '../../auth/hooks/useAuth';
import { RecordPaymentModal } from '../../payments/components/RecordPaymentModal';
import { ReversePaymentModal } from '../../payments/components/ReversePaymentModal';
import { EmailDeliveryList } from '../components/EmailDeliveryList';
import { CancelInvoiceModal } from '../components/CancelInvoiceModal';
import { invoicesApi } from '../api/invoices.api';

export function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = React.useState<InvoiceDetailResponse | null>(null);
  const [client, setClient] = React.useState<ClientResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = React.useState(false);
  const [isReversePaymentModalOpen, setIsReversePaymentModalOpen] = React.useState(false);
  const [selectedPaymentIdForReversal, setSelectedPaymentIdForReversal] = React.useState<string | null>(null);

  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [isIssuing, setIsIssuing] = React.useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  
  const { user } = useAuth();
  
  const reloadInvoice = React.useCallback(async () => {
    if (!invoiceId) return;
    try {
      const data = await apiClient.get<InvoiceDetailResponse>(`/invoices/${invoiceId}`);
      setInvoice(data);
    } catch {
      // Keep simple
    }
  }, [invoiceId]);

  const handleDownloadPdf = async () => {
    if (!invoiceId || !invoice) return;
    setIsDownloadingPdf(true);
    try {
      const blob = await apiClient.get<Blob>(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice.invoiceNumber || 'Draft'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Unable to download invoice PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSendEmail = async (isResend = false) => {
    if (!invoiceId) return;
    setIsSendingEmail(true);
    try {
      const endpoint = isResend ? `/invoices/${invoiceId}/resend` : `/invoices/${invoiceId}/send`;
      await apiClient.post(endpoint, { body: {} });
      alert(`Invoice ${isResend ? 'resent' : 'sent'} successfully.`);
      setRefreshTrigger(prev => prev + 1);
      reloadInvoice();
    } catch {
      alert(`Unable to ${isResend ? 'resend' : 'send'} invoice.`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleIssueInvoice = async () => {
    if (!invoiceId) return;
    setIsIssuing(true);
    setError(null);
    try {
      await invoicesApi.issueInvoice(invoiceId);
      setRefreshTrigger(prev => prev + 1);
      reloadInvoice();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to issue invoice.');
      }
    } finally {
      setIsIssuing(false);
    }
  };

  React.useEffect(() => {
    let mounted = true;

    async function loadInvoice() {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await apiClient.get<InvoiceDetailResponse>(`/invoices/${invoiceId}`);
        if (!mounted) return;
        setInvoice(data);

        // Fetch client details
        try {
          const clientData = await apiClient.get<ClientResponse>(`/clients/${data.clientId}`);
          if (mounted) {
            setClient(clientData);
          }
        } catch {
          // If client fetch fails, we just don't display detailed client info
        }
      } catch (err: unknown) {
        if (mounted) {
          if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 404) {
            setError('Invoice not found.');
          } else {
            setError('Failed to load invoice details.');
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    if (invoiceId) {
      loadInvoice();
    }

    return () => {
      mounted = false;
    };
  }, [invoiceId]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1200px] mx-auto">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6 max-w-[1200px] mx-auto">
        <Button variant="outline" onClick={() => navigate('/invoices')}>
          ← Back to Invoices
        </Button>
        <ErrorState 
          title="Unable to load invoice" 
          description={error || 'An unexpected error occurred.'} 
          onRetry={() => window.location.reload()} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
            ← Back
          </Button>
          <PageHeader 
            title={`Invoice ${invoice.invoiceNumber || 'Draft'}`} 
            description={client?.name || 'Unknown Client'} 
          />
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex space-x-2">

          {(user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF') && invoice.status === 'SENT' && (
            <Button variant="destructive" size="sm" onClick={() => setIsCancelModalOpen(true)}>
              Cancel Invoice
            </Button>
          )}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF') && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/new?cloneFrom=${invoice.id}`)}>
              Duplicate Invoice
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isDownloadingPdf}>
            {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
          </Button>
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF') && invoice.status === 'DRAFT' && (
            <Button size="sm" onClick={handleIssueInvoice} disabled={isIssuing}>
              {isIssuing ? 'Issuing...' : 'Issue Invoice'}
            </Button>
          )}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF') && (
            <>
              {invoice.sentAt ? (
                <Button variant="outline" size="sm" onClick={() => handleSendEmail(true)} disabled={isSendingEmail}>
                  {isSendingEmail ? 'Sending...' : 'Resend Email'}
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleSendEmail(false)} disabled={isSendingEmail}>
                  {isSendingEmail ? 'Sending...' : 'Send Email'}
                </Button>
              )}
            </>
          )}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF') && 
           (invoice.status === 'SENT' || invoice.status === 'PARTIALLY_PAID') && (
            <Button size="sm" onClick={() => setIsRecordPaymentModalOpen(true)}>
              Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {client ? (
              <>
                <p className="font-medium text-base">{client.name}</p>
                <p>{client.email}</p>
                <p>{client.phone}</p>
                <div className="pt-2">
                  <p>{client.addressLine1}</p>
                  {client.addressLine2 && <p>{client.addressLine2}</p>}
                  <p>{client.city}, {client.state} {client.postalCode}</p>
                  <p>{client.country}</p>
                </div>
                {(client.gstin || client.pan) && (
                  <div className="pt-2 text-muted-foreground">
                    {client.gstin && <p>GSTIN: {client.gstin}</p>}
                    {client.pan && <p>PAN: {client.pan}</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Client details unavailable.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground">Invoice Date</div>
              <div className="font-medium text-right">{formatDate(invoice.invoiceDate)}</div>
              
              <div className="text-muted-foreground">Due Date</div>
              <div className="font-medium text-right">{formatDate(invoice.dueDate)}</div>
              
              <div className="text-muted-foreground">Place of Supply</div>
              <div className="font-medium text-right">{invoice.placeOfSupplyState} ({invoice.placeOfSupplyStateCode})</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">GST %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.lineNumber}</TableCell>
                    <TableCell>
                      <div>
                        {item.description}
                        {item.sacCode && <div className="text-xs text-muted-foreground">SAC: {item.sacCode}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.discountAmount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.taxableAmount)}</TableCell>
                    <TableCell className="text-right">{item.gstRate}%</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end pt-6">
            <div className="w-full sm:w-1/2 md:w-1/3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              
              {parseFloat(invoice.discountTotal) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(invoice.discountTotal)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable Total</span>
                <span>{formatCurrency(invoice.taxableTotal)}</span>
              </div>

              {parseFloat(invoice.cgstTotal) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>CGST</span>
                  <span>{formatCurrency(invoice.cgstTotal)}</span>
                </div>
              )}
              {parseFloat(invoice.sgstTotal) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST</span>
                  <span>{formatCurrency(invoice.sgstTotal)}</span>
                </div>
              )}
              {parseFloat(invoice.igstTotal) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST</span>
                  <span>{formatCurrency(invoice.igstTotal)}</span>
                </div>
              )}

              <div className="flex justify-between pt-3 border-t font-semibold text-base">
                <span>Total Amount</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>

              <div className="flex justify-between pt-1 text-green-600">
                <span>Paid Amount</span>
                <span>{formatCurrency(invoice.paidAmount)}</span>
              </div>

              <div className="flex justify-between pt-1 text-amber-600 font-medium">
                <span>Outstanding Balance</span>
                <span>{formatCurrency(invoice.outstandingAmount)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(invoice.notes || invoice.terms) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground whitespace-pre-wrap">
              {invoice.notes && (
                <div>
                  <span className="font-medium text-foreground block mb-1">Notes</span>
                  {invoice.notes}
                </div>
              )}
              {invoice.terms && (
                <div>
                  <span className="font-medium text-foreground block mb-1">Terms and Conditions</span>
                  {invoice.terms}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <EmailDeliveryList invoiceId={invoiceId!} refreshTrigger={refreshTrigger} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.payments && invoice.payments.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.paidAt)}</TableCell>
                      <TableCell>{payment.method.replace('_', ' ')}</TableCell>
                      <TableCell>{payment.reference || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={payment.status === 'RECORDED' ? 'success' : 'neutral'}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {(user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF') && payment.status === 'RECORDED' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSelectedPaymentIdForReversal(payment.id);
                              setIsReversePaymentModalOpen(true);
                            }}
                          >
                            Reverse
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No payments recorded for this invoice.</p>
          )}
        </CardContent>
      </Card>

      {isRecordPaymentModalOpen && invoice && (
        <RecordPaymentModal 
          invoiceId={invoice.id}
          outstandingAmount={invoice.outstandingAmount}
          onClose={() => setIsRecordPaymentModalOpen(false)}
          onSuccess={() => {
            setIsRecordPaymentModalOpen(false);
            reloadInvoice();
          }}
        />
      )}

      {isReversePaymentModalOpen && invoice && selectedPaymentIdForReversal && (
        <ReversePaymentModal 
          invoiceId={invoice.id}
          paymentId={selectedPaymentIdForReversal}
          onClose={() => setIsReversePaymentModalOpen(false)}
          onSuccess={() => {
            setIsReversePaymentModalOpen(false);
            setSelectedPaymentIdForReversal(null);
            reloadInvoice();
          }}
        />
      )}

      {isCancelModalOpen && invoice && (
        <CancelInvoiceModal 
          invoiceId={invoice.id}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={() => {
            setIsCancelModalOpen(false);
            reloadInvoice();
          }}
        />
      )}
    </div>
  );
}
