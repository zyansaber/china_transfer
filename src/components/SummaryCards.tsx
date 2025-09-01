import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BomItem } from '@/types/bom';
import { DollarSign, Package, Clock, CheckCircle, XCircle, AlertTriangle, Hash, Ban } from 'lucide-react';

interface SummaryCardsProps {
  bomItems: BomItem[];
}

type Totals = {
  value: number;
  count: number;
  qty: number;
};

export const SummaryCards = ({ bomItems }: SummaryCardsProps) => {
  // ---- Overall totals ----
  const totalBomValue = bomItems.reduce((sum, item) => sum + (item.Value || 0), 0);
  const totalQty = bomItems.reduce((sum, item) => sum + (item.Total_Qty || 0), 0);
  const totalParts = bomItems.length;

  // ---- Kanban totals ----
  const isKanban = (item: BomItem) => (item.Kanban_Flag || '').toLowerCase() === 'kanban';
  const kanbanItems = bomItems.filter(isKanban);
  const kanbanValue = kanbanItems.reduce((sum, item) => sum + (item.Value || 0), 0);
  const kanbanQty = kanbanItems.reduce((sum, item) => sum + (item.Total_Qty || 0), 0);
  const kanbanParts = kanbanItems.length;

  // ---- Status helpers ----
  const getStatus = (item: BomItem) => item.Transfer_Status || 'Not Start';
  const statuses = ['Not Start', 'In Progress', 'Finished', 'Temporary Usage', 'Not to Transfer'] as const;

  const statusTotals: Record<string, Totals> = statuses.reduce((acc, s) => {
    acc[s] = { value: 0, count: 0, qty: 0 };
    return acc;
  }, {} as Record<string, Totals>);

  for (const item of bomItems) {
    const s = getStatus(item);
    if (!statusTotals[s]) statusTotals[s] = { value: 0, count: 0, qty: 0 };
    statusTotals[s].value += item.Value || 0;
    statusTotals[s].qty += item.Total_Qty || 0;
    statusTotals[s].count += 1;
  }

  // ---- Current BoM Parts = Not Start + In Progress (count of parts) ----
  const currentPartsCount =
    (statusTotals['Not Start']?.count || 0) + (statusTotals['In Progress']?.count || 0);

  // ---- Formatters ----
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

  const formatInt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

  // ---- Cards ----
  const cards = [
    {
      title: 'Total BoM Value',
      value: formatCurrency(totalBomValue),
      subtitle: `${formatInt(totalParts)} parts • ${formatInt(totalQty)} qty`,
      icon: DollarSign,
      className: 'text-blue-600',
      size: 'large',
    },
    {
      title: 'Kanban Value',
      value: formatCurrency(kanbanValue),
      subtitle: `${formatInt(kanbanParts)} parts • ${formatInt(kanbanQty)} qty`,
      icon: Package,
      className: 'text-purple-600',
      size: 'large',
    },
    {
      title: 'Current BoM Parts',
      value: formatInt(currentPartsCount),
      subtitle: 'Not Start + In Progress',
      icon: Hash,
      className: 'text-indigo-600',
      size: 'medium',
    },
    {
      title: 'Not Started',
      value: formatCurrency(statusTotals['Not Start']?.value || 0),
      subtitle: `${formatInt(statusTotals['Not Start']?.count || 0)} parts • ${formatInt(statusTotals['Not Start']?.qty || 0)} qty`,
      icon: Clock,
      className: 'text-yellow-600',
      size: 'small',
    },
    {
      title: 'In Progress',
      value: formatCurrency(statusTotals['In Progress']?.value || 0),
      subtitle: `${formatInt(statusTotals['In Progress']?.count || 0)} parts • ${formatInt(statusTotals['In Progress']?.qty || 0)} qty`,
      icon: AlertTriangle,
      className: 'text-orange-600',
      size: 'small',
    },
    {
      title: 'Temporary Usage',
      value: formatCurrency(statusTotals['Temporary Usage']?.value || 0),
      subtitle: `${formatInt(statusTotals['Temporary Usage']?.count || 0)} parts • ${formatInt(statusTotals['Temporary Usage']?.qty || 0)} qty`,
      icon: XCircle,
      className: 'text-rose-600',
      size: 'small',
    },
    {
      title: 'Completed',
      value: formatCurrency(statusTotals['Finished']?.value || 0),
      subtitle: `${formatInt(statusTotals['Finished']?.count || 0)} parts • ${formatInt(statusTotals['Finished']?.qty || 0)} qty`,
      icon: CheckCircle,
      className: 'text-green-600',
      size: 'small',
    },
    {
      title: 'Not to Transfer',
      value: formatCurrency(statusTotals['Not to Transfer']?.value || 0),
      subtitle: `${formatInt(statusTotals['Not to Transfer']?.count || 0)} parts • ${formatInt(statusTotals['Not to Transfer']?.qty || 0)} qty`,
      icon: Ban,
      className: 'text-red-600',
      size: 'small',
    },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.slice(0, 2).map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="lg:col-span-2">
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
                <div className={`text-2xl font-bold ${card.className}`}>
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
