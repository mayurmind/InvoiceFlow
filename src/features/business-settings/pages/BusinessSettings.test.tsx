/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BusinessSettingsPage } from './BusinessSettings';
import { apiClient } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/errors';

vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
  apiEvents: {
    onError: vi.fn(() => () => {}),
  }
}));

// Mock PageHeader to avoid icon/router issues
vi.mock('../../../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>
}));

const mockSettings = {
  id: '1',
  organizationId: 'org1',
  legalName: 'Test Corp',
  displayName: 'Test',
  gstin: null,
  pan: null,
  addressLine1: '123 Test St',
  addressLine2: null,
  city: 'Test City',
  state: 'Maharashtra',
  stateCode: '27',
  postalCode: '400001',
  country: 'India',
  email: 'test@example.com',
  phone: null,
  logoStorageKey: null,
  invoicePrefix: 'INV',
  defaultDueDays: 30,
  bankAccountName: null,
  bankAccountNumber: null,
  bankName: null,
  bankIfsc: null,
  upiId: null,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

describe('BusinessSettingsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders loading state initially', async () => {
    (apiClient.get as any).mockImplementation(() => new Promise(() => {})); // pending promise
    render(<BusinessSettingsPage />);
    
    expect(screen.getByTestId('page-header').textContent).toContain('Business Settings');
    expect(screen.queryByLabelText(/Legal Name/i)).toBeNull();
  });

  it('renders form with fetched data on successful load', async () => {
    (apiClient.get as any).mockResolvedValueOnce(mockSettings);
    render(<BusinessSettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Corp')).toBeDefined();
    });
    expect(screen.getByDisplayValue('test@example.com')).toBeDefined();
  });

  it('renders error state on API failure (403)', async () => {
    (apiClient.get as any).mockRejectedValueOnce(new ApiError(403, 'Forbidden'));
    render(<BusinessSettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/You do not have permission/i)).toBeDefined();
    });
  });

  it('shows validation errors for invalid client-side inputs', async () => {
    const user = userEvent.setup();
    (apiClient.get as any).mockResolvedValueOnce(mockSettings);
    render(<BusinessSettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Corp')).toBeDefined();
    });

    const legalNameInput = screen.getByLabelText(/Legal Name/i);
    await user.clear(legalNameInput); // make it invalid
    
    const submitBtn = screen.getByRole('button', { name: /Save Changes/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false); // becomes enabled because form is dirty
    await user.click(submitBtn);

    // Should show validation error
    expect(await screen.findByText('Legal Name is required')).toBeDefined();
    // Should NOT call the api
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it('submits successfully and shows success message', async () => {
    const user = userEvent.setup();
    (apiClient.get as any)
      .mockResolvedValueOnce(mockSettings) // first get for settings
      .mockResolvedValueOnce({ csrfToken: 'fake-csrf-token' }); // second get for csrf
      
    (apiClient.put as any).mockResolvedValueOnce({
      ...mockSettings,
      legalName: 'New Corp',
    });

    render(<BusinessSettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Corp')).toBeDefined();
    });

    const legalNameInput = screen.getByLabelText(/Legal Name/i);
    await user.clear(legalNameInput);
    await user.type(legalNameInput, 'New Corp');
    
    const submitBtn = screen.getByRole('button', { name: /Save Changes/i }) as HTMLButtonElement;
    await user.click(submitBtn);

    // Loading state for button
    expect(submitBtn.disabled).toBe(true);

    // Success alert should appear
    expect(await screen.findByText('Business settings saved successfully.')).toBeDefined();
    
    expect(apiClient.put).toHaveBeenCalledWith('/business-settings', {
      body: expect.objectContaining({
        legalName: 'New Corp'
      }),
      headers: {
        'x-csrf-token': 'fake-csrf-token'
      }
    });
  });
});
