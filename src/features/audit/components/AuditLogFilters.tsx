import * as React from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../types/audit.types';
import type { AuditLogFiltersState } from '../types/audit.types';
import type { ManagedUser } from '../../users/types/user.types';

interface AuditLogFiltersProps {
  filters: AuditLogFiltersState;
  onFilterChange: (filters: AuditLogFiltersState) => void;
  users: ManagedUser[];
}

export function AuditLogFilters({ filters, onFilterChange, users }: AuditLogFiltersProps) {
  const [localFilters, setLocalFilters] = React.useState<AuditLogFiltersState>(filters);

  // We don't sync local state back from props when it changes because the 
  // URL acts as truth and forces a re-render from the parent anyway if we used a key.
  // Or, we can just initialize from filters and let it be uncontrolled until submit.
  // Actually, to avoid the eslint rule without adding complexity, we can just remove the effect.
  // The component receives `filters` on mount. If the URL changes from outside, this local state won't update 
  // unless we force a remount. But this local state is only for the form before submit.

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setLocalFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange(localFilters);
  };

  const handleClear = () => {
    const cleared: AuditLogFiltersState = {
      actorUserId: '',
      action: '',
      entityType: '',
      entityId: '',
      dateFrom: '',
      dateTo: '',
    };
    setLocalFilters(cleared);
    onFilterChange(cleared);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            <div className="space-y-1.5">
              <label htmlFor="dateFrom" className="text-sm font-medium">Date From</label>
              <Input
                id="dateFrom"
                type="date"
                name="dateFrom"
                value={localFilters.dateFrom}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="dateTo" className="text-sm font-medium">Date To</label>
              <Input
                id="dateTo"
                type="date"
                name="dateTo"
                value={localFilters.dateTo}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="actorUserId" className="text-sm font-medium">Actor</label>
              <select
                id="actorUserId"
                name="actorUserId"
                value={localFilters.actorUserId}
                onChange={handleChange}
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Filter by Actor"
              >
                <option value="">All Actors</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="action" className="text-sm font-medium">Action</label>
              <select
                id="action"
                name="action"
                value={localFilters.action}
                onChange={handleChange}
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Filter by Action"
              >
                <option value="">All Actions</option>
                {AUDIT_ACTIONS.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="entityType" className="text-sm font-medium">Entity Type</label>
              <select
                id="entityType"
                name="entityType"
                value={localFilters.entityType}
                onChange={handleChange}
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Filter by Entity Type"
              >
                <option value="">All Entity Types</option>
                {AUDIT_ENTITY_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="entityId" className="text-sm font-medium">Entity ID</label>
              <Input
                id="entityId"
                type="text"
                name="entityId"
                value={localFilters.entityId}
                onChange={handleChange}
                placeholder="UUID"
                aria-label="Filter by Entity ID"
              />
            </div>
            
          </div>
          
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={handleClear}>
              Clear Filters
            </Button>
            <Button type="submit" size="sm">
              Apply Filters
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
