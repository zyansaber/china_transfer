import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BomItem } from '@/types/bom';
import { DollarSign, Package, Clock, CheckCircle, XCircle, AlertTriangle, Hash, Ban } from 'lucide-react';

interface SummaryCardsProps {
  bomItems: BomItem[];
}

export const SummaryCards = ({ bomItems }: SummaryCardsProps) => {
  const totalBomValue = bomItems.reduce((sum, item) => sum + item.Value, 0);
  const kanbanValue = bomItems
    .filter((item) => item.Kanban_Flag.toLowerCase() === 'kanban')
    .reduce((sum, item) => sum + item.Value, 0);

  // Count parts that are NOT finished, NOT temporary usage, and NOT not to transfer
  const partsCount = bomItems.filter((item) => {
    const status = item.Transfer_Status || 'Not Start';
    return status !== 'Finished' && status !== 'Temporary Usage' && status !== 'Not to Transfer';
  }).length;

  const statusTotals = bomItems.reduce(
    (acc, item) => {
      const status = item.Transfer_Status || 'Not Start';
      acc[status] = (acc[status] || 0) + item.Value;
      return acc;
    },
    {} as Record<string, number>
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const cards = [
    {
      title: 'Total BoM Value',
      value: formatCurrency(totalBomValue),
      icon: DollarSign,
      className: 'text-blue-600',
      size: 'large',
    },
    {
      title: 'Kanban Value',
      value: formatCurrency(kanbanValue),
      icon: Package,
      className: 'text-purple-600',
      size: 'large',
    },
    {
      title: 'BoM Parts Number',
      value: partsCount.toString(),
      icon: Hash,
      className: 'text-indigo-600',
      subtitle: 'Active Components',
      size: 'medium',
    },
    {
      title: 'Not Started',
      value: formatCurrency(statusTotals['Not Start'] || 0),
      icon: XCircle,
      className: 'text-gray-600',
      size: 'small',
    },
    {
      title: 'In Progress',
      value: formatCurrency(statusTotals['In Progress'] || 0),
      icon: Clock,
      className: 'text-orange-600',
      size: 'small',
    },
    {
      title: 'Completed',
      value: formatCurrency(statusTotals['Finished'] || 0),
      icon: CheckCircle,
      className: 'text-green-600',
      size: 'small',
    },
    {
      title: 'Not to Transfer',
      value: formatCurrency(statusTotals['Not to Transfer'] || 0),
      icon: Ban,
      className: 'text-red-600',
      size: 'small',
    },
  ];

  return (
    <div className="space-y-6 mb-6">
      {/* Primary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.slice(0, 2).map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-800">
                    {card.title}
                  </CardTitle>
                  <Icon className={`h-6 w-6 ${card.className}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${card.className}`}>
                  {card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.slice(2).map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index + 2}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-700">
                    {card.title}
                  </CardTitle>
                  {card.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
                  )}
                </div>
                <Icon className={`h-4 w-4 ${card.className}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${card.className}`}>
                  {card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};