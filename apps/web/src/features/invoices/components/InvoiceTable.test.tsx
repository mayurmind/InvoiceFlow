import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceTable } from './InvoiceTable';
import { invoicesApi } from '../api/invoices.api';
import { paymentsApi } from '../../payments/api/payments.api';
import { useAuth } from '../../auth/hooks/useAuth';
import type { User } from '../../auth/types/auth.types';
import type { InvoiceListItemResponse, ClientResponse, InvoiceDetailResponse } from '../types/invoice.types';
import type { PaymentResponse } from '../../payments/types/payments.types';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/invoices.api', () => ({
  invoicesApi: {
    issueInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
  },
}));

vi.mock('../../payments/api/payments.api', () => ({
  paymentsApi: {
    recordPayment: vi.fn(),
  },
}));

// apiClient is used by InvoiceQuickActions for email endpoints
vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

beforeAll(() => {
  window.alert = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

// ── Shared fixtures ──────────────────────────────────────────────────────────

const makeSuperAdmin = () =>
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-1', email: 'admin@example.com', role: 'SUPER_ADMIN' } as unknown as User,
    status: 'authenticated',
    login: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    reloadUser: vi.fn(),
  });

const makeStaff = () =>
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-2', email: 'staff@example.com', role: 'STAFF' } as unknown as User,
    status: 'authenticated',
    login: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    reloadUser: vi.fn(),
  });

const makeViewer = () =>
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-3', email: 'viewer@example.com', role: 'VIEWER' } as unknown as User,
    status: 'authenticated',
    login: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    reloadUser: vi.fn(),
  });

const mockClient: ClientResponse = {
  id: 'client-1',
  name: 'Acme Corp',
  email: 'billing@acme.com',
  phone: null,
  gstin: null,
  pan: null,
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Mumbai',
  state: 'Maharashtra',
  stateCode: '27',
  postalCode: '400001',
  country: 'India',
  notes: null,
  isArchived: false,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
};

const makeInvoice = (overrides: Partial<InvoiceListItemResponse> = {}): InvoiceListItemResponse => ({
  id: 'inv-1',
  clientId: 'client-1',
  invoiceNumber: 'INV/2024/0001',
  financialYear: '2024-25',
  status: 'SENT',
  invoiceDate: '2024-01-01',
  dueDate: '2024-01-15',
  currency: 'INR',
  placeOfSupplyState: 'Maharashtra',
  placeOfSupplyStateCode: '27',
  subtotal: '1000.00',
  discountTotal: '0.00',
  taxableTotal: '1000.00',
  cgstTotal: '90.00',
  sgstTotal: '90.00',
  igstTotal: '0.00',
  total: '1180.00',
  paidAmount: '0.00',
  outstandingAmount: '1180.00',
  sentAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const clientsMap = { 'client-1': mockClient };

const renderTable = (
  invoices: InvoiceListItemResponse[],
  onInvoiceUpdated = vi.fn(),
) =>
  render(
    <MemoryRouter>
      <InvoiceTable
        invoices={invoices}
        clientsMap={clientsMap}
        onInvoiceUpdated={onInvoiceUpdated}
      />
    </MemoryRouter>,
  );

// ── Tests ────────────────────────────────────────────────────────────────────

describe('InvoiceTable — Role rendering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Test 1: VIEWER sees View Details and Download PDF but NOT edit actions', async () => {
    makeViewer();
    const user = userEvent.setup();
    renderTable([makeInvoice()]);

    await user.click(screen.getByTestId('quick-actions-inv-1'));

    // Should see read-only actions
    expect(screen.getByTestId('action-view-inv-1')).toBeInTheDocument();
    expect(screen.getByTestId('action-pdf-inv-1')).toBeInTheDocument();

    // Must NOT see any write actions
    expect(screen.queryByTestId('action-payment-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-cancel-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-issue-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-duplicate-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-send-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-resend-inv-1')).not.toBeInTheDocument();
  });
});

describe('InvoiceTable — Status rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeStaff();
  });

  it('Test 2: DRAFT invoice shows Issue, no Cancel, no Record Payment, no Send/Resend', async () => {
    const user = userEvent.setup();
    renderTable([makeInvoice({ status: 'DRAFT', sentAt: null })]);

    await user.click(screen.getByTestId('quick-actions-inv-1'));

    expect(screen.getByTestId('action-issue-inv-1')).toBeInTheDocument();
    expect(screen.queryByTestId('action-payment-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-cancel-inv-1')).not.toBeInTheDocument();
    // DRAFT is blocked by assertSendableState
    expect(screen.queryByTestId('action-send-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-resend-inv-1')).not.toBeInTheDocument();
  });

  it('Test 3: SENT invoice with sentAt=null shows Send Email (not Resend), Cancel, Record Payment', async () => {
    const user = userEvent.setup();
    renderTable([makeInvoice({ status: 'SENT', sentAt: null })]);

    await user.click(screen.getByTestId('quick-actions-inv-1'));

    expect(screen.getByTestId('action-send-inv-1')).toBeInTheDocument();
    expect(screen.queryByTestId('action-resend-inv-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-cancel-inv-1')).toBeInTheDocument();
    expect(screen.getByTestId('action-payment-inv-1')).toBeInTheDocument();
    // Issue is for DRAFT only
    expect(screen.queryByTestId('action-issue-inv-1')).not.toBeInTheDocument();
  });

  it('Test 4: SENT invoice with sentAt set shows Resend Email (not Send)', async () => {
    const user = userEvent.setup();
    renderTable([makeInvoice({ status: 'SENT', sentAt: '2024-01-02T10:00:00.000Z' })]);

    await user.click(screen.getByTestId('quick-actions-inv-1'));

    expect(screen.getByTestId('action-resend-inv-1')).toBeInTheDocument();
    expect(screen.queryByTestId('action-send-inv-1')).not.toBeInTheDocument();
  });

  it('CANCELLED invoice shows neither Send nor Resend', async () => {
    const user = userEvent.setup();
    renderTable([makeInvoice({ status: 'CANCELLED', sentAt: null })]);

    await user.click(screen.getByTestId('quick-actions-inv-1'));

    expect(screen.queryByTestId('action-send-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-resend-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-cancel-inv-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-payment-inv-1')).not.toBeInTheDocument();
  });

  it('PARTIALLY_PAID shows Record Payment but not Cancel (Cancel requires SENT only)', async () => {
    const user = userEvent.setup();
    renderTable([makeInvoice({ status: 'PARTIALLY_PAID', sentAt: '2024-01-02T10:00:00.000Z' })]);

    await user.click(screen.getByTestId('quick-actions-inv-1'));

    expect(screen.getByTestId('action-payment-inv-1')).toBeInTheDocument();
    // Cancel requires SENT only per backend
    expect(screen.queryByTestId('action-cancel-inv-1')).not.toBeInTheDocument();
  });
});

describe('InvoiceTable — Interaction: Record Payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeStaff();
  });

  it('Test 5: Click Record Payment → modal opens → submit → API called → onInvoiceUpdated fired', async () => {
    const user = userEvent.setup();
    const onInvoiceUpdated = vi.fn();

    vi.mocked(paymentsApi.recordPayment).mockResolvedValueOnce({
      id: 'payment-1',
      invoiceId: 'inv-1',
      amount: '1180.00',
      method: 'BANK_TRANSFER',
      status: 'RECORDED',
      reference: null,
      notes: null,
      idempotencyKey: 'test-key',
      recordedByUserId: 'user-1',
      paidAt: '2024-01-01T00:00:00.000Z',
      reversedAt: null,
      reversedByUserId: null,
      reversalReason: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    } satisfies PaymentResponse);

    renderTable([makeInvoice({ status: 'SENT', outstandingAmount: '1180.00' })], onInvoiceUpdated);

    // Open quick actions
    await user.click(screen.getByTestId('quick-actions-inv-1'));

    // Click Record Payment
    await user.click(screen.getByTestId('action-payment-inv-1'));

    // Modal should appear — check for the heading inside the modal
    expect(screen.getByRole('heading', { name: /record payment/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toBeInTheDocument(); // amount input

    // Submit the form with default amount — click the form's submit button (not the modal heading)
    const submitBtn = screen.getByRole('button', { name: /^record payment$/i });
    await user.click(submitBtn);

    // API must be called
    await waitFor(() => {
      expect(paymentsApi.recordPayment).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({ amount: '1180.00' }),
      );
    });

    // onInvoiceUpdated must be called after success
    await waitFor(() => {
      expect(onInvoiceUpdated).toHaveBeenCalledTimes(1);
    });
  });
});

describe('InvoiceTable — Interaction: Cancel Invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeStaff();
  });

  it('Test 6: Click Cancel → modal opens → enter reason → submit → API called → onInvoiceUpdated fired', async () => {
    const user = userEvent.setup();
    const onInvoiceUpdated = vi.fn();

    vi.mocked(invoicesApi.cancelInvoice).mockResolvedValueOnce({ id: 'inv-1' } as unknown as InvoiceDetailResponse);

    renderTable([makeInvoice({ status: 'SENT' })], onInvoiceUpdated);

    // Open quick actions
    await user.click(screen.getByTestId('quick-actions-inv-1'));

    // Click Cancel Invoice
    await user.click(screen.getByTestId('action-cancel-inv-1'));

    // Modal should appear (identified by dialog role)
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/cancellation reason/i)).toBeInTheDocument();

    // Enter a reason
    await user.type(screen.getByLabelText(/cancellation reason/i), 'Created by mistake');

    // Submit
    await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    // API must be called with reason
    await waitFor(() => {
      expect(invoicesApi.cancelInvoice).toHaveBeenCalledWith('inv-1', {
        reason: 'Created by mistake',
      });
    });

    // onInvoiceUpdated must be called
    await waitFor(() => {
      expect(onInvoiceUpdated).toHaveBeenCalledTimes(1);
    });
  });

  it('Cancel modal shows API error without refreshing on failure', async () => {
    const user = userEvent.setup();
    const onInvoiceUpdated = vi.fn();

    vi.mocked(invoicesApi.cancelInvoice).mockRejectedValueOnce(
      new Error('Cannot cancel invoice with active payments.'),
    );

    renderTable([makeInvoice({ status: 'SENT' })], onInvoiceUpdated);

    await user.click(screen.getByTestId('quick-actions-inv-1'));
    await user.click(screen.getByTestId('action-cancel-inv-1'));
    await user.type(screen.getByLabelText(/cancellation reason/i), 'Testing error path');
    await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    // Error is shown
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Cannot cancel invoice with active payments.',
      );
    });

    // onInvoiceUpdated must NOT be called on failure
    expect(onInvoiceUpdated).not.toHaveBeenCalled();
  });
});

describe('InvoiceTable — Interaction: Issue Invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeSuperAdmin();
  });

  it('Test 7: Click Issue → API called → onInvoiceUpdated fired', async () => {
    const user = userEvent.setup();
    const onInvoiceUpdated = vi.fn();

    vi.mocked(invoicesApi.issueInvoice).mockResolvedValueOnce({ id: 'inv-1' } as unknown as InvoiceDetailResponse);

    renderTable([makeInvoice({ status: 'DRAFT' })], onInvoiceUpdated);

    await user.click(screen.getByTestId('quick-actions-inv-1'));
    await user.click(screen.getByTestId('action-issue-inv-1'));

    await waitFor(() => {
      expect(invoicesApi.issueInvoice).toHaveBeenCalledWith('inv-1');
    });

    await waitFor(() => {
      expect(onInvoiceUpdated).toHaveBeenCalledTimes(1);
    });
  });

  it('Issue failure does NOT call onInvoiceUpdated and shows alert', async () => {
    const user = userEvent.setup();
    const onInvoiceUpdated = vi.fn();

    vi.mocked(invoicesApi.issueInvoice).mockRejectedValueOnce(
      new Error('Only DRAFT invoices can be issued'),
    );

    renderTable([makeInvoice({ status: 'DRAFT' })], onInvoiceUpdated);

    await user.click(screen.getByTestId('quick-actions-inv-1'));
    await user.click(screen.getByTestId('action-issue-inv-1'));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Only DRAFT invoices can be issued');
    });

    expect(onInvoiceUpdated).not.toHaveBeenCalled();
  });
});

describe('RecentInvoicesTable — Regression: Dashboard integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeStaff();
  });

  it('Test 8: RecentInvoicesTable renders Quick Actions and fires onInvoiceUpdated after Issue', async () => {
    const { RecentInvoicesTable } = await import('../../../features/dashboard/components/RecentInvoicesTable');
    const user = userEvent.setup();
    const onInvoiceUpdated = vi.fn();

    vi.mocked(invoicesApi.issueInvoice).mockResolvedValueOnce({ id: 'inv-dash-1' } as unknown as InvoiceDetailResponse);

    render(
      <MemoryRouter>
        <RecentInvoicesTable
          invoices={[
            {
              id: 'inv-dash-1',
              invoiceNumber: 'INV/2024/0001',
              status: 'DRAFT',
              dueDate: '2024-01-15',
              clientName: 'Acme Corp',
              total: '1180.00',
            },
          ]}
          onInvoiceUpdated={onInvoiceUpdated}
        />
      </MemoryRouter>,
    );

    // Quick actions button is rendered per row
    await user.click(screen.getByTestId('quick-actions-inv-dash-1'));

    // Issue Invoice is visible for DRAFT
    expect(screen.getByTestId('action-issue-inv-dash-1')).toBeInTheDocument();

    // Click Issue
    await user.click(screen.getByTestId('action-issue-inv-dash-1'));

    await waitFor(() => {
      expect(invoicesApi.issueInvoice).toHaveBeenCalledWith('inv-dash-1');
    });

    await waitFor(() => {
      expect(onInvoiceUpdated).toHaveBeenCalledTimes(1);
    });
  });
});
