import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { InvoiceStatus } from '../types/dashboard.types';

interface InvoiceStatusChartProps {
  statusCounts: Record<InvoiceStatus, number>;
}

export function InvoiceStatusChart({ statusCounts }: InvoiceStatusChartProps) {
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

  const stats = [
    { label: 'Draft', count: statusCounts[InvoiceStatus.DRAFT] || 0, color: 'bg-gray-400' },
    { label: 'Sent', count: statusCounts[InvoiceStatus.SENT] || 0, color: 'bg-blue-500' },
    { label: 'Partial', count: statusCounts[InvoiceStatus.PARTIALLY_PAID] || 0, color: 'bg-amber-500' },
    { label: 'Paid', count: statusCounts[InvoiceStatus.PAID] || 0, color: 'bg-green-500' },
    { label: 'Cancelled', count: statusCounts[InvoiceStatus.CANCELLED] || 0, color: 'bg-red-500' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Status</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-md">
            No invoice data available.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="h-4 w-full flex rounded-full overflow-hidden bg-secondary">
              {stats.map((stat) => {
                if (stat.count === 0) return null;
                const percentage = (stat.count / total) * 100;
                return (
                  <div
                    key={stat.label}
                    className={`${stat.color}`}
                    style={{ width: `${percentage}%` }}
                    title={`${stat.label}: ${stat.count}`}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                    <span className="text-sm font-medium">{stat.label}</span>
                  </div>
                  <span className="text-2xl font-semibold pl-5">{stat.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
