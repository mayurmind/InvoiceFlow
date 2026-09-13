import * as React from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { InvoiceStatus } from '../types/invoice.types';

import { ClientCombobox } from '../../clients/components/ClientCombobox';

export interface InvoiceFiltersState {
  search?: string;
  status?: InvoiceStatus | '';
  clientId?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface InvoiceFiltersProps {
  filters: InvoiceFiltersState;
  onFilterChange: (filters: InvoiceFiltersState) => void;
}

export function InvoiceFilters({ filters, onFilterChange }: InvoiceFiltersProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value || undefined });
  };

  const handleClear = () => {
    onFilterChange({});
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1">
        <Input
          type="text"
          name="search"
          placeholder="Search by invoice number, client, or item..."
          value={filters.search || ''}
          onChange={handleChange}
          aria-label="Search Invoices"
        />
      </div>

      <div className="flex-1">
        <select
          name="status"
          value={filters.status || ''}
          onChange={handleChange}
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">All Statuses</option>
          {Object.values(InvoiceStatus).map(status => (
            <option key={status} value={status}>{status.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <ClientCombobox
          value={filters.clientId || ''}
          onChange={(val) => onFilterChange({ ...filters, clientId: val || undefined })}
          placeholder="All Clients"
        />
      </div>

      <div className="flex-1">
        <Input
          type="date"
          name="invoiceDateFrom"
          placeholder="Date From"
          value={filters.invoiceDateFrom || ''}
          onChange={handleChange}
          aria-label="Invoice Date From"
        />
      </div>
      
      <div className="flex-1">
        <Input
          type="date"
          name="invoiceDateTo"
          placeholder="Date To"
          value={filters.invoiceDateTo || ''}
          onChange={handleChange}
          aria-label="Invoice Date To"
        />
      </div>

      <div className="flex-1">
        <Input
          type="date"
          name="dueDateFrom"
          placeholder="Due Date From"
          value={filters.dueDateFrom || ''}
          onChange={handleChange}
          aria-label="Due Date From"
        />
      </div>
      
      <div className="flex-1">
        <Input
          type="date"
          name="dueDateTo"
          placeholder="Due Date To"
          value={filters.dueDateTo || ''}
          onChange={handleChange}
          aria-label="Due Date To"
        />
      </div>

      {hasFilters && (
        <Button variant="outline" onClick={handleClear} type="button">
          Clear
        </Button>
      )}
    </div>
  );
}
