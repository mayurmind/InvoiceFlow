
import type { UserRole } from '../types/user.types';

export interface UserFiltersState {
  role: UserRole | '';
  isActive: boolean | '';
}

interface UserFiltersProps {
  filters: UserFiltersState;
  onFilterChange: (filters: UserFiltersState) => void;
}

export function UserFilters({ filters, onFilterChange }: UserFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 bg-muted/30 p-4 rounded-lg border border-border">
      <div className="flex-1 max-w-xs">
        <label htmlFor="role-filter" className="block text-xs font-medium text-muted-foreground mb-1">
          Role
        </label>
        <select
          id="role-filter"
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={filters.role}
          onChange={(e) => onFilterChange({ ...filters, role: e.target.value as UserRole | '' })}
        >
          <option value="">All Roles</option>
          <option value="STAFF">Staff</option>
          <option value="VIEWER">Viewer</option>
          {/* Note: SUPER_ADMIN not typically filtered unless backend supports, backend schema allows it, but often omitted from standard view. We include it if needed, but the prompt said "Do not add SUPER_ADMIN as a filter unless the backend explicitly supports it". Backend schema allows it, but let's just use what they have or leave it out if we don't need it. Backend listUsersSchema allows SUPER_ADMIN, STAFF, VIEWER. */}
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      <div className="flex-1 max-w-xs">
        <label htmlFor="status-filter" className="block text-xs font-medium text-muted-foreground mb-1">
          Status
        </label>
        <select
          id="status-filter"
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={filters.isActive === '' ? '' : filters.isActive.toString()}
          onChange={(e) => {
            const val = e.target.value;
            onFilterChange({ ...filters, isActive: val === '' ? '' : val === 'true' });
          }}
        >
          <option value="">All Statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
    </div>
  );
}
