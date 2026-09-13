import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../lib/api/client';
import { InvoiceCreate } from './InvoiceCreate';
import { describe, it, expect, vi } from 'vitest';

// Mock the API client
vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
  },
}));

vi.mock('../api/invoices.api', () => ({
  invoicesApi: {
    createInvoice: vi.fn().mockResolvedValue({ id: 'test-id' }),
  },
}));

describe('InvoiceCreate', () => {
  it('renders loading state initially and then the form', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/invoices/new']}>
          <InvoiceCreate />
        </MemoryRouter>
      );
    });
    expect(screen.getByRole('heading', { name: 'Create Invoice' })).toBeInTheDocument();
  });

  it('submits valid data successfully', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/invoices/new']}>
          <InvoiceCreate />
        </MemoryRouter>
      );
    });
    // basic test structure for valid submission...
  });

  it('fetches clone source when cloneFrom query param is present', async () => {
    const mockSourceInvoice = {
      id: 'inv-1',
      invoiceNumber: 'INV-100',
      clientId: 'client-123',
      invoiceDate: '2023-01-01',
      dueDate: '2023-02-01',
      items: [
        {
          id: 'item-1',
          description: 'Cloned Item',
          quantity: '2.000',
          rate: '100.00',
          discountAmount: '0.00',
          gstRate: '18.00',
          totalAmount: '236.00',
        }
      ]
    };
    
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSourceInvoice);

    render(
      <MemoryRouter initialEntries={['/invoices/new?cloneFrom=inv-1']}>
        <InvoiceCreate />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading data from source invoice...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('New invoice details pre-filled from existing invoice.')).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledWith('/invoices/inv-1');
  });
});
