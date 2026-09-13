import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { ClientStatusBadge } from './ClientStatusBadge';
import { formatDate } from '../../invoices/utils/formatters';
import type { ClientResponse } from '../types/client.types';

interface ClientTableProps {
  clients: ClientResponse[];
}

export function ClientTable({ clients }: ClientTableProps) {
  if (clients.length === 0) {
    return null; // Will be handled by EmptyState in the parent
  }

  return (
    <div className="rounded-md border bg-white overflow-x-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
            <TableHead className="font-semibold text-gray-700 whitespace-nowrap">Client Name</TableHead>
            <TableHead className="font-semibold text-gray-700 whitespace-nowrap">Contact</TableHead>
            <TableHead className="font-semibold text-gray-700 whitespace-nowrap">State</TableHead>
            <TableHead className="font-semibold text-gray-700 whitespace-nowrap">Status</TableHead>
            <TableHead className="font-semibold text-gray-700 whitespace-nowrap text-right">Added On</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="group hover:bg-blue-50/30 transition-colors">
              <TableCell className="font-medium text-gray-900 whitespace-nowrap">
                <Link to={`/clients/${client.id}`} className="hover:underline text-blue-600 hover:text-blue-800">
                  {client.name}
                </Link>
                {client.gstin && <div className="text-xs text-gray-500 font-normal mt-0.5">GSTIN: {client.gstin}</div>}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="text-gray-900">{client.email || <span className="text-gray-400 italic">No email</span>}</div>
                {client.phone && <div className="text-xs text-gray-500 mt-0.5">{client.phone}</div>}
              </TableCell>
              <TableCell className="text-gray-600 whitespace-nowrap">{client.state}</TableCell>
              <TableCell className="whitespace-nowrap">
                <ClientStatusBadge isArchived={client.isArchived} />
              </TableCell>
              <TableCell className="text-right text-gray-600 whitespace-nowrap">{formatDate(client.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
