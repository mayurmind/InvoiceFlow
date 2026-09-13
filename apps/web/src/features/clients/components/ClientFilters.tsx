import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { INDIA_STATES_AND_UT } from '../../business-settings/constants/business-settings.constants';
import type { ClientStatusFilter } from '../types/client.types';

export interface ClientFiltersState {
  search: string;
  status: ClientStatusFilter | '';
  stateCode: string;
}

interface ClientFiltersProps {
  filters: ClientFiltersState;
  onFilterChange: (filters: ClientFiltersState) => void;
}

export function ClientFilters({ filters, onFilterChange }: ClientFiltersProps) {
  const [searchTerm, setSearchTerm] = React.useState(filters.search);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        onFilterChange({ ...filters, search: searchTerm });
      }
    }, 400); // debounce
    return () => clearTimeout(timer);
  }, [searchTerm, filters, onFilterChange]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      status: e.target.value as ClientStatusFilter | '',
    });
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      stateCode: e.target.value,
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          type="search"
          placeholder="Search clients..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="flex flex-1 gap-2 sm:max-w-[400px]">
        <select
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={filters.status}
          onChange={handleStatusChange}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        
        <select
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={filters.stateCode}
          onChange={handleStateChange}
          aria-label="Filter by state"
        >
          <option value="">All States</option>
          {INDIA_STATES_AND_UT.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
