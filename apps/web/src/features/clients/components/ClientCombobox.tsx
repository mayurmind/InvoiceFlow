import * as React from 'react';
import { Search, ChevronDown, Check, Loader2, X } from 'lucide-react';
import { apiClient } from '../../../lib/api/client';
import type { ClientResponse, ClientListResponse } from '../types/client.types';

export interface ClientComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ClientCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = 'Search for a client...',
  className = '',
}: ClientComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [options, setOptions] = React.useState<ClientResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<ClientResponse | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial client if we only have an ID
  React.useEffect(() => {
    let mounted = true;
    async function fetchInitialClient() {
      if (!value) {
        setSelectedClient(null);
        return;
      }
      
      // If we already have the client object in options or state, skip fetching
      if (selectedClient?.id === value) return;
      const foundInOptions = options.find((o) => o.id === value);
      if (foundInOptions) {
        setSelectedClient(foundInOptions);
        return;
      }

      try {
        const client = await apiClient.get<ClientResponse>(`/clients/${value}`);
        if (mounted) {
          setSelectedClient(client);
        }
      } catch (err) {
        console.error('Failed to load initial client', err);
      }
    }
    fetchInitialClient();
    return () => {
      mounted = false;
    };
  }, [value, options, selectedClient]);

  // Debounced search
  React.useEffect(() => {
    let mounted = true;
    const timer = setTimeout(async () => {
      if (!isOpen) return;
      
      try {
        setIsLoading(true);
        const queryParams = new URLSearchParams();
        queryParams.set('limit', '20');
        if (search) queryParams.set('search', search);

        const response = await apiClient.get<ClientListResponse>(`/clients?${queryParams.toString()}`);
        if (mounted) {
          setOptions(response.data);
        }
      } catch (err) {
        console.error('Failed to search clients', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [search, isOpen]);

  const handleSelect = (client: ClientResponse) => {
    setSelectedClient(client);
    onChange(client.id);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClient(null);
    onChange('');
    setSearch('');
  };

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearch('');
      // focus input when opening
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Combobox Trigger */}
      <div 
        className={`flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm ring-offset-background transition-colors focus-within:ring-1 focus-within:ring-ring ${disabled ? 'cursor-not-allowed opacity-50 bg-muted/50' : 'cursor-pointer bg-background'}`}
        onClick={toggleOpen}
      >
        <div className="flex-1 truncate">
          {selectedClient ? (
            <span className="font-medium">{selectedClient.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {value && !disabled && (
            <button
              type="button"
              className="hover:text-foreground p-0.5 rounded-sm hover:bg-muted"
              onClick={handleClear}
              aria-label="Clear selection"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
      </div>

      {/* Combobox Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 zoom-in-95">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-50" />}
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {options.length === 0 && !isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No clients found.
              </div>
            ) : (
              options.map((client) => (
                <div
                  key={client.id}
                  className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${value === client.id ? 'bg-accent/50' : ''}`}
                  onClick={() => handleSelect(client)}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === client.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div className="flex flex-col">
                    <span>{client.name}</span>
                    {client.email && (
                      <span className="text-xs text-muted-foreground">{client.email}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
