import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="space-y-2 text-center">
          <Badge variant="secondary">F1.3 — Design System</Badge>
          <h1 className="text-4xl font-bold tracking-tight">InvoiceFlow</h1>
          <p className="text-muted-foreground">Professional invoice and payment management.</p>
        </div>

        <Separator />

        {/* Design system preview card */}
        <Card>
          <CardHeader>
            <CardTitle>Design System Active</CardTitle>
            <CardDescription>
              Core components and tokens are wired and ready for future UI phases.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Paid</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="destructive">Overdue</Badge>
            <Badge variant="outline">Outline</Badge>
          </CardContent>
        </Card>

        {/* CTA placeholder — no business logic */}
        <div className="flex gap-3">
          <Button className="flex-1">Get Started</Button>
          <Button variant="outline" className="flex-1">
            Learn More
          </Button>
        </div>
      </div>
    </main>
  );
}
