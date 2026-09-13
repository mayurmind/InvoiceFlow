import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="Test Title" description="Test Description" />);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByText('Test Title')) as any).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByText('Test Description')) as any).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <PageHeader 
        title="Test Title" 
        actions={<button>Action Button</button>}
      />
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByRole('button', { name: 'Action Button' })) as any).toBeInTheDocument();
  });
});
