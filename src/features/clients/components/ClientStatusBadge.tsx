import { Badge } from '../../../components/ui/badge';
interface ClientStatusBadgeProps {
  isArchived: boolean;
}

export function ClientStatusBadge({ isArchived }: ClientStatusBadgeProps) {
  if (isArchived) {
    return <Badge variant="neutral">Archived</Badge>;
  }

  return <Badge variant="success">Active</Badge>;
}
