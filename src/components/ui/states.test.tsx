import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';

describe('EmptyState', () => {
  it('renders correctly', () => {
    render(<EmptyState title="No items" description="Create an item to get started" />);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByText('No items')) as any).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByText('Create an item to get started')) as any).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders correctly', () => {
    render(<ErrorState title="Oops" description="Failed to load" />);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByText('Oops')) as any).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByText('Failed to load')) as any).toBeInTheDocument();
  });
});
