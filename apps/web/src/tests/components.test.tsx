/**
 * @vitest-environment jsdom
 *
 * Component smoke tests — verify that core design-system components
 * render without throwing. These tests intentionally stay minimal:
 * they confirm imports work and React can mount each component.
 * Behavioural tests belong in feature-specific test files.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';

// ── Button ──────────────────────────────────────────────────────────
describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined();
  });

  it('renders with outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button', { name: 'Outline' })).toBeDefined();
  });

  it('renders as disabled', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

// ── Badge ────────────────────────────────────────────────────────────
describe('Badge', () => {
  it('renders default badge', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('renders success badge', () => {
    render(<Badge variant="success">Paid</Badge>);
    expect(screen.getByText('Paid')).toBeDefined();
  });
});

// ── Card ─────────────────────────────────────────────────────────────
describe('Card', () => {
  it('renders card with header and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>Card body</CardContent>
      </Card>,
    );
    expect(screen.getByText('Test Card')).toBeDefined();
    expect(screen.getByText('Card body')).toBeDefined();
  });
});

// ── Input ─────────────────────────────────────────────────────────────
describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter value" />);
    expect(screen.getByPlaceholderText('Enter value')).toBeDefined();
  });
});

// ── Skeleton ──────────────────────────────────────────────────────────
describe('Skeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    expect(container.firstChild).toBeDefined();
  });
});

// ── LoadingSpinner ────────────────────────────────────────────────────
describe('LoadingSpinner', () => {
  it('renders with accessible role and label', () => {
    render(<LoadingSpinner label="Loading data" />);
    expect(screen.getByRole('status', { name: 'Loading data' })).toBeDefined();
  });
});

// ── EmptyState ────────────────────────────────────────────────────────
describe('EmptyState', () => {
  it('renders heading and description', () => {
    render(
      <EmptyState heading="No invoices" description="Create your first invoice to get started." />,
    );
    expect(screen.getByText('No invoices')).toBeDefined();
    expect(screen.getByText('Create your first invoice to get started.')).toBeDefined();
  });
});

// ── Layout: PageContainer ─────────────────────────────────────────────
describe('PageContainer', () => {
  it('renders children', () => {
    render(<PageContainer>Page content</PageContainer>);
    expect(screen.getByText('Page content')).toBeDefined();
  });
});

// ── Layout: PageHeader ────────────────────────────────────────────────
describe('PageHeader', () => {
  it('renders heading', () => {
    render(<PageHeader heading="Clients" />);
    expect(screen.getByRole('heading', { name: 'Clients', level: 1 })).toBeDefined();
  });

  it('renders description when provided', () => {
    render(<PageHeader heading="Invoices" description="Manage all invoices." />);
    expect(screen.getByText('Manage all invoices.')).toBeDefined();
  });
});

// ── Table ─────────────────────────────────────────────────────────────
describe('Table', () => {
  it('renders table elements', () => {
    render(
      <Table>
        <TableCaption>A list of your recent invoices.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>INV001</TableCell>
            <TableCell>Paid</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>$250.00</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    expect(screen.getByText('A list of your recent invoices.')).toBeDefined();
    expect(screen.getByText('INV001')).toBeDefined();
  });
});

// ── Dialog ────────────────────────────────────────────────────────────
describe('Dialog', () => {
  it('renders dialog elements without crashing', () => {
    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText('Open Dialog')).toBeDefined();
  });
});

// ── DropdownMenu ──────────────────────────────────────────────────────
describe('DropdownMenu', () => {
  it('renders dropdown menu elements without crashing', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByText('Open Menu')).toBeDefined();
  });
});

// ── Form ──────────────────────────────────────────────────────────────
describe('Form', () => {
  it('renders form elements without crashing', () => {
    const TestForm = () => {
      const form = useForm({
        defaultValues: {
          username: '',
        },
      });

      return (
        <Form {...form}>
          <form>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="shadcn" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      );
    };

    render(<TestForm />);
    expect(screen.getByText('Username')).toBeDefined();
  });
});
