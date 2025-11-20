import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BomItem } from '@/types/bom';
import { DollarSign, Package, Clock, CheckCircle, AlertTriangle, Hash, Ban } from 'lucide-react';

/** Named + default export to avoid import mismatch */
interface SummaryCardsProps {
  bomItems: BomItem[];
}

type Totals = {
  value: number;
  count: number; // parts count
  qty: number;   // total quantity
};

/** Safe number coercion */
const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Status union aligned with data */
type TransferStatus =
  | 'Not Start'
  | 'In Progress'
  | 'Finished'
  | 'Not to Transfer';

const STATUSES: TransferStatus[] = [
  'Not Start',
  'In Progress',
  'Finished',
  'Not to Transfer',
];

export const SummaryCards = ({ bomItems }: SummaryCardsProps) => {
  // ---- Overall totals ----
  const totalBomValue = bomItems.reduce((sum, item) => sum + num((item as any).Value), 0);
  const totalQty = bomItems.reduce((sum, item) => sum + num((item as any).Total_Qty), 0);
  const totalParts = bomItems.length;

  // ---- Kanban totals ----
  const isKanban = (item: BomItem) => {
    const flag = String((item as any).Kanban_Flag ?? '').toLowerCase().trim();
    return flag === 'kanban' || flag === 'y' || flag === 'yes' || flag === '1' || flag === 'true';
  };
  const kanbanItems = bomItems.filter(isKanban);
  const kanbanValue = kanbanItems.reduce((sum, item) => sum + num((item as any).Value), 0);
  const kanbanQty = kanbanItems.reduce((sum, item) => sum + num((item as any).Total_Qty), 0);
  const kanbanParts = kanbanItems.length;

  // ---- Status helpers ----
  const getStatus = (item: BomItem): TransferStatus => {
    const s = (item as any).Transfer_Status as string | undefined;
    const norm = (s ?? 'Not Start').toLowerCase();
    if (norm === 'not started') return 'Not Start';
    if (norm === 'in progress') return 'In Progress';
    if (norm === 'finished' || norm === 'completed') return 'Finished';
    if (norm === 'not to transfer' || norm === 'not-transfer' || norm === 'no transfer') return 'Not to Transfer';
    return 'Not Start';
  };

  const statusTotals: Record<TransferStatus, Totals> = Object.fromEntries(
    STATUSES.map((s) => [s, { value: 0, count: 0, qty: 0 }])
  ) as Record<TransferStatus, Totals>;

  for (const item of bomItems) {
    const s = getStatus(item);
    statusTotals[s].value += num((item as any).Value);
    statusTotals[s].qty += num((item as any).Total_Qty);
    statusTotals[s].count += 1; // parts count
  }

  // ---- Parts counts for "Current BoM (parts)" ----
  const targetToTransferParts =
    (statusTotals['Not Start']?.count || 0) + (statusTotals['In Progress']?.count || 0);
  const notToTransferParts = statusTotals['Not to Transfer']?.count || 0;
  const currentBomParts = targetToTransferParts + notToTransferParts;

  // ---- Formatters ----
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

  const formatInt = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

  // ---- Cards ----
  const cards = [
    {
      title: 'Total BoM Value',
      value: formatCurrency(totalBomValue),
      subtitle: `${formatInt(totalParts)} parts • ${formatInt(totalQty)} qty`,
      icon: DollarSign,
      className: 'text-blue-600',
      size: 'large' as const,
    },
    {
      title: 'Kanban Value',
      value: formatCurrency(kanbanValue),
      subtitle: `${formatInt(kanbanParts)} parts • ${formatInt(kanbanQty)} qty`,
      icon: Package,
      className: 'text-purple-600',
      size: 'large' as const,
    },
    // --- Current BoM (parts) = Not Start (parts) + In Progress (parts) + Not to Transfer (parts) ---
    {
      title: 'Current BoM (parts)',
      value: formatInt(currentBomParts),
      // Explicit plus sign: (Not Start + In Progress) + (Not to Transfer)
      subtitleJSX: (
        <span className="text-xs text-gray-600">
          <span className="font-medium">{formatInt(targetToTransferParts)} target to transfer</span>
          <span className="px-1"> + </span>
          <span className="font-semibold text-red-600">
            {formatInt(notToTransferParts)} Not to Transfer
          </span>
        </span>
      ),
      icon: Hash,
      className: 'text-indigo-600',
      size: 'medium' as const,
    },
    {
      title: 'Not Started',
      value: formatCurrency(statusTotals['Not Start']?.value || 0),
      subtitle: `${formatInt(statusTotals['Not Start']?.count || 0)} parts • ${formatInt(statusTotals['Not Start']?.qty || 0)} qty`,
      icon: Clock,
      className: 'text-yellow-600',
      size: 'small' as const,
    },
    {
      title: 'In Progress',
      value: formatCurrency(statusTotals['In Progress']?.value || 0),
      subtitle: `${formatInt(statusTotals['In Progress']?.count || 0)} parts • ${formatInt(statusTotals['In Progress']?.qty || 0)} qty`,
      icon: AlertTriangle,
      className: 'text-orange-600',
      size: 'small' as const,
    },
    {
      title: 'Temporary Usage',
      value: formatCurrency(statusTotals['Temporary Usage']?.value || 0),
      subtitle: `${formatInt(statusTotals['Temporary Usage']?.count || 0)} parts • ${formatInt(statusTotals['Temporary Usage']?.qty || 0)} qty`,
      icon: XCircle,
      className: 'text-rose-600',
      size: 'small' as const,
    },
    {
      title: 'Completed',
      value: formatCurrency(statusTotals['Finished']?.value || 0),
      subtitle: `${formatInt(statusTotals['Finished']?.count || 0)} parts • ${formatInt(statusTotals['Finished']?.qty || 0)} qty`,
      icon: CheckCircle,
      className: 'text-green-600',
      size: 'small' as const,
    },
    {
      title: 'Not to Transfer',
      value: formatCurrency(statusTotals['Not to Transfer']?.value || 0),
      subtitle: `${formatInt(statusTotals['Not to Transfer']?.count || 0)} parts • ${formatInt(statusTotals['Not to Transfer']?.qty || 0)} qty`,
      icon: Ban,
      className: 'text-red-600',
      size: 'small' as const,
    },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.slice(0, 2).map((card, index) => {
          const Icon = (card as any).icon;
          return (
            <Card key={index} className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-700">
                    {(card as any).title}
                  </CardTitle>
                  {('subtitleJSX' in card) ? (
                    <div className="mt-1">{(card as any).subtitleJSX}</div>
                  ) : (('subtitle' in card) && (card as any).subtitle) ? (
                    <p className="text-xs text-gray-500 mt-1">{(card as any).subtitle}</p>
                  ) : null}
                </div>
                <Icon className={`h-4 w-4 ${(card as any).className}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${(card as any).className}`}>
                  {(card as any).value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.slice(2).map((card, index) => {
          const Icon = (card as any).icon;
          return (
            <Card key={index + 2}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-700">
                    {(card as any).title}
                  </CardTitle>
                  {('subtitleJSX' in card) ? (
                    <div className="mt-1">{(card as any).subtitleJSX}</div>
                  ) : (('subtitle' in card) && (card as any).subtitle) ? (
                    <p className="text-xs text-gray-500 mt-1">{(card as any).subtitle}</p>
                  ) : null}
                </div>
                <Icon className={`h-4 w-4 ${(card as any).className}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${(card as any).className}`}>
                  {(card as any).value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SummaryCards;
