import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { InvoiceEdit } from './InvoiceEdit';
import { describe, it, expect, vi } from 'vitest';

// Mock the API client
vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    put: vi.fn(),
  },
}));

describe('InvoiceEdit', () => {
  it('renders loading state initially and then the form', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <InvoiceEdit />
        </BrowserRouter>
      );
    });
    expect(screen.getByRole('heading', { name: 'Edit Invoice' })).toBeInTheDocument();
  });
});
