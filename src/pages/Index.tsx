import { useMemo, useState } from 'react';
import { addMonths, format, isBefore, isValid, parseISO, startOfMonth } from 'date-fns';
import {
  Activity,
  ArrowUpDown,
  BadgeCheck,
  CalendarIcon,
  ClipboardList,
  Factory,
  FilePieChart,
  Flag,
  Layers,
  NotebookPen,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { useBomData } from '@/hooks/useBomData';
import { TransferStatus } from '@/types/bom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { StatusButton } from '@/components/StatusButton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const formatCurrency = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${value < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${value < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCompactNumber = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}${(abs / 1_000).toFixed(1)}K`;
  return `${value}`;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

type TabKey =
  | 'completed'
  | 'plan'
  | 'current'
  | 'remaining'
  | 'report';

const sidebarNav: { key: TabKey; label: string; description: string; icon: typeof Activity }[] = [
  { key: 'completed', label: 'Completed', description: 'Volume, value, and timing', icon: BadgeCheck },
  { key: 'plan', label: 'Plan (In Progress)', description: 'Forecast finish and value', icon: NotebookPen },
  { key: 'current', label: 'Current BoM', description: 'Not Start items only', icon: Layers },
  { key: 'remaining', label: 'Remaining in AU', description: 'Not to Transfer with notes', icon: Flag },
  { key: 'report', label: 'Report', description: 'Generate portfolio snapshot', icon: FilePieChart },
];

const SectionHeader = ({ title, description, icon: Icon }: { title: string; description: string; icon: typeof Activity }) => (
  <div className="flex items-center justify-between">
    <div>
      <div className="flex items-center gap-2 text-slate-900">
        <Icon className="h-5 w-5 text-indigo-600" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  </div>
);

const DateSelector = ({
  value,
  onChange,
}: {
  value?: string;
  onChange: (newDate: string | null) => void;
}) => {
  const parsed = value ? parseDate(value) : null;

  const normalized = parsed ? startOfMonth(parsed) : null;

  const monthOptions = useMemo(() => {
    const start = startOfMonth(new Date());
    const options = Array.from({ length: 18 }, (_, index) => {
      const date = addMonths(start, index - 3);
      return {
        value: date.toISOString(),
        label: format(date, 'MMM yyyy'),
        sortValue: +date,
      };
    });

    if (normalized) {
      const normalizedValue = normalized.toISOString();
      if (!options.some((option) => option.value === normalizedValue)) {
        options.push({ value: normalizedValue, label: format(normalized, 'MMM yyyy'), sortValue: +normalized });
      }
    }

    return options.sort((a, b) => a.sortValue - b.sortValue);
  }, [normalized]);

  return (
    <Select
      value={normalized ? normalized.toISOString() : 'none'}
      onValueChange={(newValue) => {
        if (!newValue) return;
        if (newValue === 'none') {
          onChange(null);
          return;
        }
        const selected = parseDate(newValue) ?? new Date(newValue);
        onChange(startOfMonth(selected).toISOString());
      }}
    >
      <SelectTrigger className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
        <CalendarIcon className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Select month" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No month</SelectItem>
        {monthOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default function ProfessionalDashboard() {
  const {
    bomItems,
    loading,
    error,
    updateStatus,
    updateExpectedCompletion,
    updateNotToTransferDetails,
    updatePlannedStart,
  } = useBomData();
  const [activeTab, setActiveTab] = useState<TabKey>('completed');
  const [sortField, setSortField] = useState<'Value' | 'Standard_Price' | 'Total_Qty'>('Value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const completedItems = useMemo(
    () => bomItems.filter((item) => (item.Transfer_Status || 'Not Start') === 'Finished'),
    [bomItems]
  );

  const planItems = useMemo(
    () => bomItems.filter((item) => (item.Transfer_Status || 'Not Start') === 'In Progress'),
    [bomItems]
  );

  const currentBomItems = useMemo(
    () => bomItems.filter((item) => (item.Transfer_Status || 'Not Start') === 'Not Start'),
    [bomItems]
  );

  const remainingItems = useMemo(
    () => bomItems.filter((item) => (item.Transfer_Status || 'Not Start') === 'Not to Transfer'),
    [bomItems]
  );

  const sortItems = useMemo(
    () =>
      function sort(items: typeof bomItems) {
        return [...items].sort((a, b) => {
          let aValue: number;
          let bValue: number;

          switch (sortField) {
            case 'Standard_Price':
              aValue = a.Standard_Price;
              bValue = b.Standard_Price;
              break;
            case 'Total_Qty':
              aValue = a.Total_Qty;
              bValue = b.Total_Qty;
              break;
            case 'Value':
            default:
              aValue = a.Value;
              bValue = b.Value;
          }

          if (sortDirection === 'asc') {
            return aValue - bValue;
          }
          return bValue - aValue;
        });
      },
    [sortDirection, sortField]
  );

  const sortedCompleted = useMemo(() => sortItems(completedItems), [completedItems, sortItems]);
  const sortedPlan = useMemo(() => sortItems(planItems), [planItems, sortItems]);
  const sortedCurrent = useMemo(() => sortItems(currentBomItems), [currentBomItems, sortItems]);
  const sortedRemaining = useMemo(() => sortItems(remainingItems), [remainingItems, sortItems]);
  const totalPartsBaseline =
    remainingItems.length + currentBomItems.length + planItems.length + completedItems.length;

  const SortControls = ({ title }: { title?: string }) => {
    const sortOptions: { key: typeof sortField; label: string }[] = [
      { key: 'Standard_Price', label: 'Unit price' },
      { key: 'Value', label: 'Total value' },
      { key: 'Total_Qty', label: 'Total qty' },
    ];

    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{title || 'Sort by'}</span>
        {sortOptions.map((option) => (
          <Button
            key={option.key}
            size="sm"
            variant={sortField === option.key ? 'default' : 'outline'}
            className="h-8 text-xs"
            onClick={() => {
              if (sortField === option.key) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
              } else {
                setSortField(option.key);
                setSortDirection('desc');
              }
            }}
          >
            {option.label}
            {sortField === option.key && <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
        >
          <ArrowUpDown className="mr-1 h-3 w-3" />
          {sortDirection === 'asc' ? 'Low to High' : 'High to Low'}
        </Button>
      </div>
    );
  };

  const completed2025 = useMemo(
    () =>
      completedItems.filter((item) => {
        const latest = parseDate(item.Latest_Component_Date) || parseDate(item.Status_UpdatedAt);
        return latest?.getFullYear() === 2025;
      }),
    [completedItems]
  );

  const completedChart = useMemo(() => {
    const monthMap = new Map<string, { month: string; sortValue: number; count: number; value: number }>();

    completed2025.forEach((item) => {
      const date = parseDate(item.Latest_Component_Date) || parseDate(item.Status_UpdatedAt);
      if (!date) return;
      const key = format(date, 'yyyy-MM');
      const existing = monthMap.get(key) ?? {
        month: format(date, 'MMM'),
        sortValue: +startOfMonth(date),
        count: 0,
        value: 0,
      };
      existing.count += 1;
      existing.value += item.Value || 0;
      monthMap.set(key, existing);
    });

    return Array.from(monthMap.values()).sort((a, b) => a.sortValue - b.sortValue);
  }, [completed2025]);

  const completedDecline = useMemo(() => {
    const monthMap = new Map<number, { month: string; sortValue: number; completed: number }>();

    completed2025.forEach((item) => {
      const date = parseDate(item.Latest_Component_Date) || parseDate(item.Status_UpdatedAt);
      if (!date) return;
      const sortValue = +startOfMonth(date);
      const entry = monthMap.get(sortValue) ?? {
        month: format(date, 'MMM'),
        sortValue,
        completed: 0,
      };
      entry.completed += 1;
      monthMap.set(sortValue, entry);
    });

    const ordered = Array.from(monthMap.values()).sort((a, b) => a.sortValue - b.sortValue);

    let remaining = totalPartsBaseline;
    return ordered.map((entry) => {
      const remainingAfter = Math.max(remaining - entry.completed, 0);
      const dataPoint = {
        month: entry.month,
        remaining,
        remainingAfter,
      };
      remaining = remainingAfter;
      return dataPoint;
    });
  }, [completed2025, totalPartsBaseline]);

  const planForecast = useMemo(() => {
    const today = new Date();
    const monthMap = new Map<
      string,
      { month: string; sortValue: number; parts: number; value: number; delayedParts: number }
    >();

    planItems.forEach((item) => {
      const expected = parseDate(item.Expected_Completion);
      if (!expected) return;
      const key = format(expected, 'yyyy-MM');
      const entry = monthMap.get(key) ?? {
        month: format(expected, 'MMM'),
        sortValue: +startOfMonth(expected),
        parts: 0,
        value: 0,
        delayedParts: 0,
      };
      entry.parts += 1;
      entry.value += item.Value || 0;
      if (isBefore(expected, today)) {
        entry.delayedParts += 1;
      }
      monthMap.set(key, entry);
    });

    return Array.from(monthMap.values()).sort((a, b) => a.sortValue - b.sortValue);
  }, [planItems]);

  const plannedStartSchedule = useMemo(() => {
    const monthMap = new Map<string, { month: string; sortValue: number; starts: number }>();

    currentBomItems.forEach((item) => {
      const planned = parseDate(item.Planned_Start);
      if (!planned) return;
      const key = format(planned, 'yyyy-MM');
      const entry = monthMap.get(key) ?? {
        month: format(planned, 'MMM'),
        sortValue: +startOfMonth(planned),
        starts: 0,
      };
      entry.starts += 1;
      monthMap.set(key, entry);
    });

    return Array.from(monthMap.values()).sort((a, b) => a.sortValue - b.sortValue);
  }, [currentBomItems]);

  const plannedStartTrajectory = useMemo(() => {
    let remaining = currentBomItems.length;

    const ordered = plannedStartSchedule.length
      ? plannedStartSchedule
      : [
          {
            month: format(new Date(), 'MMM'),
            sortValue: +startOfMonth(new Date()),
            starts: 0,
          },
        ];

    return ordered.map((entry) => {
      const remainingAfterStart = Math.max(remaining - entry.starts, 0);
      const chartRow = { month: entry.month, plannedStarts: entry.starts, remaining: remainingAfterStart };
      remaining = remainingAfterStart;
      return chartRow;
    });
  }, [currentBomItems.length, plannedStartSchedule]);

  const professionalPalette = {
    surface: 'bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm',
  } as const;

  const delayedCount = planItems.filter((item) => {
    const expected = parseDate(item.Expected_Completion);
    return expected ? isBefore(expected, new Date()) : false;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-12 space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const summary = {
    totalValue: bomItems.reduce((sum, item) => sum + (item.Value || 0), 0),
    completedValue: completedItems.reduce((sum, item) => sum + (item.Value || 0), 0),
    totalParts: bomItems.length,
    completedParts: completedItems.length,
  };

  const remainingSummary = useMemo(
    () => ({
      count: remainingItems.length,
      totalQty: remainingItems.reduce((sum, item) => sum + (item.Total_Qty || 0), 0),
      totalValue: remainingItems.reduce((sum, item) => sum + (item.Value || 0), 0),
    }),
    [remainingItems]
  );

  const reportText = `BoM Transfer Report\n\n- Parts completed: ${summary.completedParts}/${summary.totalParts}\n- Completion rate: ${Math.round(
    (summary.completedParts / Math.max(summary.totalParts, 1)) * 100
  )}%\n- Value completed: ${formatCurrency(summary.completedValue)}\n- Remaining (excluding Not to Transfer): ${currentBomItems.length} parts\n- Delayed plans: ${delayedCount}\nGenerated on: ${format(new Date(), 'PPpp')}`;

  const renderCompleted = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Completed"
        description="Dual-axis distribution by latest domestic purchase date"
        icon={BadgeCheck}
      />

      <Card className={professionalPalette.surface}>
        <CardContent className="grid gap-4 md:grid-cols-3 md:divide-x divide-slate-200 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">2025 parts closed</span>
            <span className="text-3xl font-semibold text-slate-900">{completed2025.length}</span>
          </div>
          <div className="flex flex-col gap-1 px-0 md:px-6">
            <span className="text-xs uppercase tracking-wide text-slate-500">2025 value saved</span>
            <span className="text-3xl font-semibold text-emerald-600">
              {formatCurrency(completed2025.reduce((sum, item) => sum + (item.Value || 0), 0))}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Completion rate</span>
            <span className="text-3xl font-semibold text-indigo-600">
              {Math.round((summary.completedParts / Math.max(summary.totalParts, 1)) * 100)}%
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1.05fr] 2xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card className={professionalPalette.surface}>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Completion distribution</CardTitle>
                <CardDescription>Volume and value on independent axes (latest domestic buy date)</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">2025</Badge>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ChartContainer
                  config={{
                    count: { label: 'Parts', color: 'hsl(215, 85%, 55%)' },
                    value: { label: 'Value', color: 'hsl(158, 70%, 45%)' },
                  }}
                >
                  <ResponsiveContainer>
                    <ComposedChart data={completedChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={formatCompactNumber}
                        label={{ value: 'Parts', angle: -90, position: 'insideLeft' }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={formatCompactNumber}
                        label={{ value: 'Total Value', angle: 90, position: 'insideRight' }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="count"
                        name="Parts"
                        fill="var(--color-count)"
                        radius={[6, 6, 0, 0]}
                        barSize={32}
                      />
                      <Line
                        type="monotone"
                        yAxisId="right"
                        dataKey="value"
                        name="Value"
                        stroke="var(--color-value)"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card className={professionalPalette.surface}>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>2025 total quantity decline</CardTitle>
                <CardDescription>Baseline: all AU hold + Not Start + In Progress + Completed</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">Cumulative</Badge>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ChartContainer
                  config={{
                    remaining: { label: 'Remaining before month', color: 'hsl(215, 80%, 50%)' },
                    remainingAfter: { label: 'Remaining after completions', color: 'hsl(34, 94%, 50%)' },
                  }}
                >
                  <ResponsiveContainer>
                    <ComposedChart data={completedDecline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={formatCompactNumber} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="remaining"
                        name="Remaining before"
                        stroke="var(--color-remaining)"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                      />
                      <Bar
                        dataKey="remainingAfter"
                        name="After completions"
                        fill="var(--color-remainingAfter)"
                        radius={[8, 8, 0, 0]}
                        barSize={32}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={professionalPalette.surface}>
          <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Completed parts detail</CardTitle>
              <CardDescription>Saved latest domestic purchase dates</CardDescription>
            </div>
            <SortControls title="Sort completed" />
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[760px]">
              <div className="divide-y divide-slate-200">
                {sortedCompleted.map((item) => (
                  <div
                    key={item.Component_Material}
                    className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.35fr)] lg:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.Component_Material} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image</div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{item.Component_Material}</p>
                          <Badge variant="outline" className="text-xs">Completed</Badge>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-4 md:items-center">
                      <div className="flex flex-col text-right md:items-end">
                        <span className="text-xs text-slate-500">Total value</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(item.Value || 0)}</span>
                      </div>
                      <div className="flex flex-col text-right md:items-end">
                        <span className="text-xs text-slate-500">Unit price</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(item.Standard_Price || 0)}</span>
                        <span className="text-[11px] text-slate-500">Qty: {item.Total_Qty || 0}</span>
                      </div>
                      <div className="flex flex-col text-right md:items-end">
                        <span className="text-xs text-slate-500">Latest domestic buy</span>
                        <span className="font-semibold text-slate-900">{item.Latest_Component_Date || 'N/A'}</span>
                        <span className="text-[11px] text-slate-500">Status: {item.Transfer_Status || 'Finished'}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2 text-xs text-slate-500 md:justify-self-end">
                        <span className="hidden md:inline">Kanban: {item.Kanban_Flag || '-'}</span>
                        <StatusButton
                          currentStatus={(item.Transfer_Status || 'Not Start') as TransferStatus}
                          onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {completedItems.length === 0 && (
                  <div className="p-4 text-sm text-slate-500">No completed items recorded.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderPlan = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Plan (In Progress)"
        description="Forecasted completions with value overlay and expected dates"
        icon={NotebookPen}
      />

      <Card className={professionalPalette.surface}>
        <CardContent className="grid gap-4 md:grid-cols-3 md:divide-x divide-slate-200 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">In progress</span>
            <span className="text-3xl font-semibold text-slate-900">{planItems.length}</span>
          </div>
          <div className="flex flex-col gap-1 px-0 md:px-6">
            <span className="text-xs uppercase tracking-wide text-slate-500">Delayed</span>
            <span className="text-3xl font-semibold text-amber-600">{delayedCount} parts</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Value in progress</span>
            <span className="text-3xl font-semibold text-emerald-600">
              {formatCurrency(planItems.reduce((sum, item) => sum + (item.Value || 0), 0))}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-[1fr_1.25fr]">
        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle>Monthly forecast</CardTitle>
            <CardDescription>Stacked volume with value trendline; delayed parts flagged</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ChartContainer
                config={{
                  parts: { label: 'Forecasted parts', color: 'hsl(215, 80%, 55%)' },
                  value: { label: 'Forecasted value', color: 'hsl(221, 39%, 11%)' },
                  delayed: { label: 'Past due', color: 'hsl(34, 94%, 50%)' },
                }}
              >
                <ResponsiveContainer>
                  <ComposedChart data={planForecast}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" tickFormatter={formatCompactNumber} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={formatCompactNumber} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="parts"
                      name="Parts"
                      stackId="a"
                      fill="var(--color-parts)"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="delayedParts"
                      name="Past due"
                      stackId="a"
                      fill="var(--color-delayed)"
                      radius={[8, 8, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      yAxisId="right"
                      dataKey="value"
                      name="Value"
                      stroke="var(--color-value)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className={professionalPalette.surface}>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Planned detail</CardTitle>
              <CardDescription>Expected completion dates saved to Firebase</CardDescription>
            </div>
            <SortControls title="Sort in progress" />
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[620px]">
              <div className="divide-y divide-slate-200">
                {sortedPlan.map((item) => {
                  const expected = parseDate(item.Expected_Completion);
                  const isDelayed = expected ? isBefore(expected, new Date()) : false;
                  return (
                    <div
                      key={item.Component_Material}
                      className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.45fr)] lg:items-start"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.Component_Material} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image</div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900">{item.Component_Material}</p>
                            <Badge variant="outline" className={isDelayed ? 'border-amber-300 text-amber-700' : ''}>
                              In Progress
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                        </div>
                      </div>
                      <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-5 md:items-start">
                        <div className="flex flex-col text-xs text-slate-500 md:items-end">
                          <span className="uppercase tracking-wide">Value</span>
                          <span className="text-base font-semibold text-slate-900">{formatCurrency(item.Value || 0)}</span>
                        </div>
                        <div className="flex flex-col text-xs text-slate-500 md:items-end">
                          <span className="uppercase tracking-wide">Unit price</span>
                          <span className="text-base font-semibold text-slate-900">{formatCurrency(item.Standard_Price || 0)}</span>
                          <span className="text-[11px] text-slate-500">Qty: {item.Total_Qty || 0}</span>
                        </div>
                        <div className="md:col-span-2 md:w-full">
                          <Label className="text-xs text-slate-500">Expected completion</Label>
                          <DateSelector
                            value={item.Expected_Completion}
                            onChange={async (newDate) => {
                              await updateExpectedCompletion(item.Component_Material, newDate);
                            }}
                          />
                          {isDelayed && <p className="mt-1 text-xs text-amber-600">Past due</p>}
                        </div>
                        <div className="flex flex-col items-start gap-2 md:items-end">
                          <span className="text-xs text-slate-500">Latest buy: {item.Latest_Component_Date || 'N/A'}</span>
                          <StatusButton
                            currentStatus={(item.Transfer_Status || 'Not Start') as TransferStatus}
                            onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {planItems.length === 0 && (
                  <div className="p-4 text-sm text-slate-500">No items are in progress.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCurrent = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Current BoM"
        description="Only Not Start parts; trajectory toward zero"
        icon={Layers}
      />

      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-[1fr_1.2fr]">
        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle>Current BoM schedule</CardTitle>
            <CardDescription>Plan start months and remaining inventory inside one view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ChartContainer
                config={{
                  remaining: { label: 'Remaining after starts', color: 'hsl(215, 80%, 50%)' },
                  plannedStarts: { label: 'Planned starts', color: 'hsl(142, 71%, 45%)' },
                }}
              >
                <ResponsiveContainer>
                  <ComposedChart data={plannedStartTrajectory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={formatCompactNumber} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="remaining"
                      name="Remaining after starts"
                      stroke="var(--color-remaining)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                    <Bar
                      dataKey="plannedStarts"
                      name="Planned starts"
                      fill="var(--color-plannedStarts)"
                      radius={[6, 6, 0, 0]}
                      barSize={32}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className={professionalPalette.surface}>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Not Start detail</CardTitle>
              <CardDescription>Record planned starts while keeping the chart locked beside the table</CardDescription>
            </div>
            <SortControls title="Sort Not Start" />
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[620px]">
              <div className="divide-y divide-slate-200">
                {sortedCurrent.map((item) => (
                  <div
                    key={item.Component_Material}
                    className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.5fr)] md:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.Component_Material} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image</div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{item.Component_Material}</p>
                          <Badge variant="outline" className="text-xs">Not Start</Badge>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-4 md:items-center">
                      <div className="flex flex-col text-right md:items-end">
                        <span className="text-xs text-slate-500">Total value</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(item.Value || 0)}</span>
                      </div>
                      <div className="flex flex-col text-right md:items-end">
                        <span className="text-xs text-slate-500">Unit price</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(item.Standard_Price || 0)}</span>
                        <span className="text-[11px] text-slate-500">Qty: {item.Total_Qty || 0}</span>
                      </div>
                      <div className="w-full md:justify-self-end">
                        <Label className="mb-1 block text-xs text-slate-500">Planned start</Label>
                        <DateSelector
                          value={item.Planned_Start}
                          onChange={async (value) => {
                            await updatePlannedStart(item.Component_Material, value);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 text-xs text-slate-500 md:justify-self-end">
                        <span className="hidden md:inline">Kanban: {item.Kanban_Flag || '-'}</span>
                        <StatusButton
                          currentStatus={(item.Transfer_Status || 'Not Start') as TransferStatus}
                          onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {currentBomItems.length === 0 && (
                  <div className="p-4 text-sm text-slate-500">All parts have moved beyond Not Start.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderRemaining = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Remaining in AU"
        description="Not to Transfer items held in AU with reason and brand"
        icon={Factory}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-slate-200 bg-white/80">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">AU holds</div>
            <div className="text-2xl font-semibold text-slate-900">{remainingSummary.count}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white/80">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total quantity</div>
            <div className="text-2xl font-semibold text-slate-900">{remainingSummary.totalQty}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white/80">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total value</div>
            <div className="text-2xl font-semibold text-indigo-600">{formatCurrency(remainingSummary.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className={professionalPalette.surface}>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Hold detail</CardTitle>
            <CardDescription>Capture reason and brand for each Not to Transfer item</CardDescription>
          </div>
          <SortControls title="Sort holds" />
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {sortedRemaining.map((item) => (
                <div
                  key={item.Component_Material}
                  className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)] lg:items-start"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.Component_Material} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image</div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{item.Component_Material}</p>
                        <Badge variant="outline" className="text-xs">Not to Transfer</Badge>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>Value {formatCurrency(item.Value || 0)}</span>
                        <span>Unit {formatCurrency(item.Standard_Price || 0)}</span>
                        <span>Qty {item.Total_Qty || 0}</span>
                        <span>Kanban: {item.Kanban_Flag || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 lg:max-w-xl">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Reason</Label>
                        <Input
                          defaultValue={item.NotToTransferReason || ''}
                          placeholder="Why held in AU"
                          onBlur={async (e) => {
                            const updatedReason = e.target.value || '';
                            await updateNotToTransferDetails(
                              item.Component_Material,
                              updatedReason,
                              item.Brand || ''
                            );
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Brand</Label>
                        <Input
                          defaultValue={item.Brand || ''}
                          placeholder="Brand"
                          onBlur={async (e) => {
                            const updatedBrand = e.target.value || '';
                            await updateNotToTransferDetails(
                              item.Component_Material,
                              item.NotToTransferReason || '',
                              updatedBrand
                            );
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <StatusButton
                        currentStatus={(item.Transfer_Status || 'Not Start') as TransferStatus}
                        onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                      />
                      <span className="text-slate-400">Recorded in Firebase</span>
                    </div>
                  </div>
                </div>
              ))}
              {remainingItems.length === 0 && (
                <div className="p-4 text-sm text-slate-500">No Not to Transfer items remain in AU.</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderReport = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Report"
        description="One-click snapshot across completion, value, and risk"
        icon={FilePieChart}
      />

      <Card className={professionalPalette.surface}>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Stage overview</CardTitle>
            <CardDescription>Completion, value, delays, and current BoM snapshot</CardDescription>
          </div>
          <Button
            onClick={() => {
              const blob = new Blob([reportText], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'bom-transfer-report.txt';
              link.click();
              URL.revokeObjectURL(url);
            }}
            variant="outline"
            className="gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            Export report
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Completion</div>
              <div className="text-2xl font-semibold text-slate-900">
                {Math.round((summary.completedParts / Math.max(summary.totalParts, 1)) * 100)}%
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Value completed</div>
              <div className="text-2xl font-semibold text-emerald-600">
                {formatCurrency(summary.completedValue)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Past-due plans</div>
              <div className="text-2xl font-semibold text-amber-600">{delayedCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Current BoM (Not Start)</div>
              <div className="text-2xl font-semibold text-indigo-600">{currentBomItems.length}</div>
            </div>
          </div>
          <Separator />
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-900/90 p-4 text-sm text-slate-50">
            {reportText}
          </pre>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'completed':
        return renderCompleted();
      case 'plan':
        return renderPlan();
      case 'current':
        return renderCurrent();
      case 'remaining':
        return renderRemaining();
      case 'report':
        return renderReport();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:py-12 xl:px-8">
        <aside className="w-full rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm lg:w-52 lg:self-start lg:sticky lg:top-8 xl:w-56">
          <div className="flex items-center gap-2 pb-4">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Transfer dashboard</p>
              <p className="text-base font-semibold text-slate-900">Operations view</p>
            </div>
          </div>
          <Separator className="my-3" />
          <ScrollArea className="h-[70vh] pr-3">
            <div className="space-y-2">
              {sidebarNav.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-3 text-left transition',
                      active ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200'
                    )}
                  >
                    <div className="flex items-center gap-2 text-slate-900">
                      <Icon className="h-4 w-4 text-indigo-600" />
                      <span className="font-semibold">{item.label}</span>
                    </div>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">BoM Transfer Command Center</h1>
              <p className="text-sm text-slate-600">
                Track completions, plans, AU holds, and reporting in one professional view.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Activity className="h-4 w-4 text-emerald-600" />
              Data synced from Firebase
            </div>
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  );
}
