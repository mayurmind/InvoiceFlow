import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Card, CardContent } from '../../../components/ui/card';
import type { AuditLog } from '../types/audit.types';
import { formatDate } from '../../invoices/utils/formatters';

interface AuditLogTableProps {
  auditLogs: AuditLog[];
}

export function AuditLogTable({ auditLogs }: AuditLogTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(log.createdAt)}
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.actorUser ? (
                      <div>
                        <div className="font-medium">
                          {log.actorUser.firstName} {log.actorUser.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.actorUser.email}
                        </div>
                      </div>
                    ) : log.actorUserId ? (
                      <span className="text-muted-foreground">{log.actorUserId}</span>
                    ) : (
                      <span className="text-muted-foreground italic">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.entityType}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.entityId || <span className="text-muted-foreground italic">N/A</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
