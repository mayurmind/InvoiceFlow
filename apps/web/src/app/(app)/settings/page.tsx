import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Settings } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Configure your business details, invoice defaults, and preferences.',
};

/**
 * Settings placeholder — F1.4.
 * Business settings API is implemented in P4; UI is wired in P8.
 * Access is restricted to SUPER_ADMIN (UI hint via nav filter — backend enforces).
 */
export default function SettingsPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          heading="Settings"
          description="Configure your business details, invoice defaults, and preferences."
        />
        <EmptyState
          icon={<Settings className="h-6 w-6" />}
          heading="Settings coming soon"
          description="Business configuration options will be available once the backend is connected."
        />
      </div>
    </PageContainer>
  );
}
