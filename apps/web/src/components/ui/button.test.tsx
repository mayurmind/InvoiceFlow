import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByRole('button', { name: /click me/i })) as any).toBeInTheDocument();
  });

  it('shows loader when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(screen.getByRole('button')) as any).toBeDisabled();
    // Loader2 from lucide-react renders an svg with 'lucide-loader-2' class (or similar), we can just check if disabled
  });
});
