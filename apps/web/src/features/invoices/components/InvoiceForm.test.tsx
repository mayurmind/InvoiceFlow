import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceForm } from './InvoiceForm';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

vi.mock('../../clients/components/ClientCombobox', () => ({
  ClientCombobox: ({ onChange }: { onChange: (id: string) => void }) => (
    <button 
      type="button" 
      data-testid="mock-client" 
      onClick={() => onChange('test-client-id')}
    >
      Select Client
    </button>
  )
}));

describe('InvoiceForm', () => {
  it('renders form with initial empty state', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <InvoiceForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={false}
        submitLabel="Create"
      />
    );

    expect(screen.getByText(/Client \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Invoice Date \*/i)).toBeInTheDocument();
    expect(screen.getByText('Line Items *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Item/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create/i })).toBeInTheDocument();
  });

  it('validates client selection', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <InvoiceForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={false}
        submitLabel="Create"
      />
    );

    const form = screen.getByRole('button', { name: /Create/i }).closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    expect(screen.getByText('Please select a client.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('adds and removes line items', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <InvoiceForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={false}
        submitLabel="Create"
      />
    );

    // Initial item count is 1
    let removeButtons = screen.getAllByRole('button', { name: /✕/i });
    expect(removeButtons).toHaveLength(1);
    expect(removeButtons[0]).toBeDisabled(); // Cannot remove last item

    // Add item
    const addButton = screen.getByRole('button', { name: /Add Item/i });
    await user.click(addButton);

    removeButtons = screen.getAllByRole('button', { name: /✕/i });
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).not.toBeDisabled();

    // Remove first item
    await user.click(removeButtons[0]);
    removeButtons = screen.getAllByRole('button', { name: /✕/i });
    expect(removeButtons).toHaveLength(1);
  });

  it('submits with issueImmediately flag when Save & Issue is clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <InvoiceForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={false}
        submitLabel="Create"
      />
    );

    // Fill minimum required fields
    // 1. Select client
    await user.click(screen.getByTestId('mock-client'));
    
    // 2. Add description for the default line item
    const descriptionInput = screen.getByPlaceholderText('Item description');
    await user.type(descriptionInput, 'Test item');

    // Submit using Save & Issue button
    const saveAndIssueBtn = screen.getByRole('button', { name: /Save & Issue/i });
    
    // The form prevents default, we must fire the actual form submit event manually? 
    // Wait, clicking a submit button inside a form triggers the submit event.
    await user.click(saveAndIssueBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    // onSubmit signature: (data, issueImmediately)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'test-client-id',
        items: expect.arrayContaining([
          expect.objectContaining({ description: 'Test item' })
        ])
      }),
      true // <--- issueImmediately flag is true
    );
  });
});
