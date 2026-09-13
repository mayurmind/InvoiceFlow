import { Badge } from '../../../components/ui/badge';
import { InvoiceStatus } from '../types/invoice.types';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const getBadgeVariant = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'success';
      case InvoiceStatus.PARTIALLY_PAID:
        return 'warning';
      case InvoiceStatus.DRAFT:
      case InvoiceStatus.CANCELLED:
        return 'neutral';
      case InvoiceStatus.SENT:
        return 'info';
      default:
        return 'default';
    }
  };

  const getLabel = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PARTIALLY_PAID:
        return 'PARTIAL';
      default:
        return status;
    }
  };

  return (
    <Badge variant={getBadgeVariant(status)}>
      {getLabel(status)}
    </Badge>
  );
}
