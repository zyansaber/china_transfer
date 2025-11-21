import { useMemo, useState } from 'react';
import { format, isBefore, isValid, parseISO, startOfMonth } from 'date-fns';
import {
  Activity,
  BadgeCheck,
  CalendarIcon,
  ClipboardList,
  Factory,
  FilePieChart,
  Flag,
  Layers,
  Lightbulb,
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {parsed ? format(parsed, 'PP') : 'Select date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed ?? undefined}
          onSelect={(date) => onChange(date ? date.toISOString() : null)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
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
                  <YAxis yAxisId="left" tickFormatter={formatCompactNumber} label={{ value: 'Parts', angle: -90, position: 'insideLeft' }} />
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
                    barSize={26}
                    fill="var(--color-count)"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="value"
                    name="Value"
                    barSize={26}
                    fill="var(--color-value)"
                    radius={[8, 8, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>Completed parts</CardTitle>
          <CardDescription>Latest domestic purchase month, value, and imagery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {completedItems.map((item) => {
                const lastBuy = parseDate(item.Latest_Component_Date);
                return (
                  <div
                    key={item.Component_Material}
                    className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-center"
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
                          <Badge className="bg-emerald-50 text-emerald-700">Finished</Badge>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3 md:items-center md:justify-items-end">
                      <span className="font-semibold text-slate-900 md:text-right">{formatCurrency(item.Value || 0)}</span>
                      <span className="md:text-right">{lastBuy ? format(lastBuy, 'MMM yyyy') : 'N/A'}</span>
                      <span className="text-xs text-slate-500 md:text-right">
                        Updated {item.Status_UpdatedAt ? format(parseDate(item.Status_UpdatedAt) || new Date(), 'PP') : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {completedItems.length === 0 && (
                <div className="p-4 text-sm text-slate-500">No completed records yet.</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPlan = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Plan (In Progress)"
        description="Register expected completion dates, track value and slippage"
        icon={NotebookPen}
      />

      <Card className={professionalPalette.surface}>
        <CardContent className="grid gap-4 md:grid-cols-3 md:divide-x divide-slate-200 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">In progress</span>
            <span className="text-3xl font-semibold text-slate-900">{planItems.length} parts</span>
          </div>
          <div className="flex flex-col gap-1 px-0 md:px-6">
            <span className="text-xs uppercase tracking-wide text-slate-500">Forecasted parts</span>
            <span className="text-3xl font-semibold text-indigo-600">
              {planForecast.reduce((sum, item) => sum + item.parts, 0)} parts
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Past due</span>
            <span className="text-3xl font-semibold text-amber-600">{delayedCount} parts</span>
          </div>
        </CardContent>
      </Card>

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
        <CardHeader>
          <CardTitle>Planned detail</CardTitle>
          <CardDescription>Expected completion dates saved to Firebase</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {planItems.map((item) => {
                const expected = parseDate(item.Expected_Completion);
                const isDelayed = expected ? isBefore(expected, new Date()) : false;
                return (
                  <div
                    key={item.Component_Material}
                    className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)] lg:items-start"
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
                    <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-4 md:items-center md:justify-items-end">
                      <div className="flex flex-col text-xs text-slate-500 md:items-end">
                        <span className="uppercase tracking-wide">Value</span>
                        <span className="text-base font-semibold text-slate-900">{formatCurrency(item.Value || 0)}</span>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCurrent = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Current BoM"
        description="Only Not Start parts; trajectory toward zero"
        icon={Layers}
      />

      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>Current BoM schedule</CardTitle>
          <CardDescription>Plan start months and remaining inventory inside one view</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-sm font-medium text-slate-800">Planned start trajectory</p>
              <p className="text-xs text-slate-500">Record start dates below; chart stays aligned with the table frame</p>
            </div>
            <div className="h-64 px-4 pt-4">
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
            <Separator />
            <div className="divide-y divide-slate-200">
              {currentBomItems.map((item) => (
                <div
                  key={item.Component_Material}
                  className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)] md:items-center"
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
                  <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3 md:items-center md:justify-items-end">
                    <span className="font-semibold text-slate-900 md:text-right">{formatCurrency(item.Value || 0)}</span>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderRemaining = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Remaining in AU"
        description="Not to Transfer items held in AU with reason and brand"
        icon={Factory}
      />

      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>Hold detail</CardTitle>
          <CardDescription>Capture reason and brand for each Not to Transfer item</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {remainingItems.map((item) => (
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
                        <span>Kanban: {item.Kanban_Flag || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 lg:max-w-xl">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Reason</Label>
                        <Input
                          defaultValue={item.NotToTransferReason}
                          placeholder="Why held in AU"
                          onBlur={async (e) => {
                            await updateNotToTransferDetails(
                              item.Component_Material,
                              e.target.value,
                              item.Brand || ''
                            );
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Brand</Label>
                        <Input
                          defaultValue={item.Brand}
                          placeholder="Brand"
                          onBlur={async (e) => {
                            await updateNotToTransferDetails(
                              item.Component_Material,
                              item.NotToTransferReason || '',
                              e.target.value
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
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row lg:py-12">
        <aside className="w-full rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm lg:w-64">
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
