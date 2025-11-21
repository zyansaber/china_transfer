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
  Lightbulb,
  NotebookPen,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
  return isValid(parsed) ? startOfMonth(parsed) : null;
};

type TabKey =
  | 'completed'
  | 'plan'
  | 'current'
  | 'remaining'
  | 'report';

const filterByQuery = <T extends { Component_Material: string; Description_EN?: string }>(
  items: T[],
  query: string
) => {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) =>
    item.Component_Material.toLowerCase().includes(q) || (item.Description_EN || '').toLowerCase().includes(q)
  );
};

const buildSearchSuggestions = <T extends { Component_Material: string; Description_EN?: string }>(
  items: T[],
  query: string,
  limit = 6
) => {
  const q = query.trim().toLowerCase();
  if (!q) return [] as string[];

  const pool = items.flatMap((item) => [item.Component_Material, item.Description_EN].filter(Boolean) as string[]);
  const unique = Array.from(new Set(pool));

  return unique.filter((value) => value.toLowerCase().includes(q)).slice(0, limit);
};

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
  const monthOptions = useMemo(() => {
    const months: { label: string; value: string }[] = [];
    const start = startOfMonth(new Date(new Date().getFullYear() - 1, 0, 1));

    for (let i = 0; i < 24; i += 1) {
      const month = addMonths(start, i);
      months.push({ label: format(month, 'MMM yyyy'), value: month.toISOString() });
    }

    return months;
  }, []);

  const handleSelect = (date?: Date) => {
    if (!date) {
      onChange(null);
      return;
    }

    const monthStart = startOfMonth(date);
    onChange(monthStart.toISOString());
  };

  return (
    <Select
      value={parsed ? parsed.toISOString() : ''}
      onValueChange={(newValue) => {
        if (!newValue) {
          onChange(null);
          return;
        }
        handleSelect(new Date(newValue));
      }}
    >
      <SelectTrigger className="w-full justify-between text-sm">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-slate-500" />
          <SelectValue placeholder="Select month" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Clear</SelectItem>
        {monthOptions.map((month) => (
          <SelectItem key={month.value} value={month.value}>
            {month.label}
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
  const [completedSearch, setCompletedSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const [currentSearch, setCurrentSearch] = useState('');
  const [remainingSearch, setRemainingSearch] = useState('');

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
  const filteredCompleted = useMemo(
    () => filterByQuery(sortedCompleted, completedSearch),
    [sortedCompleted, completedSearch]
  );
  const filteredPlan = useMemo(() => filterByQuery(sortedPlan, planSearch), [sortedPlan, planSearch]);
  const filteredCurrent = useMemo(
    () => filterByQuery(sortedCurrent, currentSearch),
    [sortedCurrent, currentSearch]
  );
  const filteredRemaining = useMemo(
    () => filterByQuery(sortedRemaining, remainingSearch),
    [sortedRemaining, remainingSearch]
  );
  const completedSuggestions = useMemo(
    () => buildSearchSuggestions(sortedCompleted, completedSearch),
    [sortedCompleted, completedSearch]
  );
  const planSuggestions = useMemo(() => buildSearchSuggestions(sortedPlan, planSearch), [sortedPlan, planSearch]);
  const currentSuggestions = useMemo(
    () => buildSearchSuggestions(sortedCurrent, currentSearch),
    [sortedCurrent, currentSearch]
  );
  const remainingSuggestions = useMemo(
    () => buildSearchSuggestions(sortedRemaining, remainingSearch),
    [sortedRemaining, remainingSearch]
  );
  const totalPartsBaseline = bomItems.length;

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

  const SearchInput = ({
    label,
    value,
    onChange,
    suggestions,
    placeholder,
  }: {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
  }) => (
    <div className="space-y-1 text-sm">
      {label && <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>}
      <div className="relative">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {value && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 z-20 mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
                onClick={() => onChange(suggestion)}
                type="button"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="line-clamp-1">{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
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
        <div className="w-full px-6 py-12 space-y-4 sm:px-8 lg:px-12">
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
        <div className="w-full px-6 py-12 sm:px-8 lg:px-12">
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

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.05fr_1fr]">
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
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle>2025 total quantity decline</CardTitle>
            <CardDescription>Cumulative remaining parts as completions land</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ChartContainer
                config={{
                  remainingAfter: { label: 'Remaining after month', color: 'hsl(221, 83%, 53%)' },
                }}
              >
                <ComposedChart data={completedDecline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={formatCompactNumber} label={{ value: 'Parts', angle: -90, position: 'insideLeft' }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="remainingAfter"
                    name="Remaining parts"
                    stroke="var(--color-remainingAfter)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={`${professionalPalette.surface}`}>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Completed parts</CardTitle>
            <CardDescription>Latest domestic purchase month, value, and imagery</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <SearchInput
              label="Search"
              value={completedSearch}
              onChange={setCompletedSearch}
              suggestions={completedSuggestions}
              placeholder="Filter by code or description"
            />
            <SortControls title="Sort completed" />
          </div>
        </CardHeader>
        <CardContent className="p-0 text-[15px]">
          <ScrollArea className="h-[620px]">
            <div className="divide-y divide-slate-200">
              {filteredCompleted.map((item) => {
                const lastBuy = parseDate(item.Latest_Component_Date);
                return (
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
                            <Badge className="bg-emerald-50 text-emerald-700">Finished</Badge>
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-4 md:items-center">
                        <div className="flex flex-col text-right md:items-end">
                          <span className="text-xs text-slate-500">Total value</span>
                          <span className="font-semibold text-slate-900">{formatCurrency(item.Value || 0)}</span>
                        </div>
                        <div className="flex flex-col text-right md:items-end">
                          <span className="text-xs text-slate-500">Unit price</span>
                          <span className="font-semibold text-slate-900">{formatCurrency(item.Standard_Price || 0)}</span>
                        </div>
                        <div className="flex flex-col text-right md:items-end">
                          <span className="text-xs text-slate-500">Total qty</span>
                          <span className="font-semibold text-slate-900">{item.Total_Qty || 0}</span>
                        </div>
                        <div className="flex flex-col text-right md:items-end">
                          <span className="text-xs text-slate-500">Latest buy</span>
                          <span>{lastBuy ? format(lastBuy, 'MMM yyyy') : 'N/A'}</span>
                        </div>
                      </div>
                  </div>
                );
              })}
              {filteredCompleted.length === 0 && (
                <div className="p-4 text-sm text-slate-500">No completed records match the search.</div>
              )}
            </div>
          </ScrollArea>
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
                  barSize={26}
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="delayedParts"
                  name="Past due"
                  stackId="a"
                  fill="var(--color-delayed)"
                  radius={[8, 8, 0, 0]}
                  barSize={26}
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
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className={professionalPalette.surface}>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Planned detail</CardTitle>
            <CardDescription>Expected completion dates saved to Firebase</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <SearchInput
              label="Search"
              value={planSearch}
              onChange={setPlanSearch}
              suggestions={planSuggestions}
              placeholder="Filter by code or description"
            />
            <SortControls title="Sort in progress" />
          </div>
        </CardHeader>
        <CardContent className="p-0 text-[15px]">
          <ScrollArea className="h-[620px]">
            <div className="divide-y divide-slate-200">
              {filteredPlan.map((item) => {
                  const expected = parseDate(item.Expected_Completion);
                  const isDelayed = expected ? isBefore(expected, new Date()) : false;
                  return (
                    <div
                      key={item.Component_Material}
                      className="grid gap-5 p-4 lg:grid-cols-[1.5fr_1.05fr_1.2fr_0.95fr] lg:items-center"
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
                      <div className="flex flex-col gap-1 text-right text-slate-700 lg:items-end">
                        <span className="text-xs text-slate-500">Total value</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(item.Value || 0)}</span>
                        <span className="text-[12px] text-slate-500">Qty: {item.Total_Qty || 0}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-right text-slate-700 lg:items-end">
                        <span className="text-xs uppercase tracking-wide text-slate-500">Unit price</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(item.Standard_Price || 0)}</span>
                      </div>
                      <div className="flex flex-col gap-2 text-slate-700">
                        <Label className="text-xs text-slate-500">Expected completion</Label>
                        <DateSelector
                          value={item.Expected_Completion}
                          onChange={async (newDate) => {
                            await updateExpectedCompletion(item.Component_Material, newDate);
                          }}
                        />
                        {isDelayed && <p className="text-xs text-amber-600">Past due</p>}
                      </div>
                      <div className="flex flex-col items-start gap-2 text-slate-700 lg:items-end">
                        <span className="text-xs text-slate-500">Latest buy: {item.Latest_Component_Date || 'N/A'}</span>
                        <StatusButton
                          currentStatus={(item.Transfer_Status || 'Not Start') as TransferStatus}
                          onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                        />
                      </div>
                    </div>
                  );
              })}
              {filteredPlan.length === 0 && (
                <div className="p-4 text-sm text-slate-500">No items are in progress for this search.</div>
              )}
            </div>
          </ScrollArea>
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
        <CardContent>
          <div className="h-72">
            <ChartContainer
              config={{
                remaining: { label: 'Remaining after starts', color: 'hsl(215, 80%, 50%)' },
                plannedStarts: { label: 'Planned starts', color: 'hsl(142, 71%, 45%)' },
              }}
            >
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
                  barSize={26}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className={professionalPalette.surface}>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Not Start detail</CardTitle>
            <CardDescription>Record planned starts while keeping the chart locked beside the table</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <SearchInput
              label="Search"
              value={currentSearch}
              onChange={setCurrentSearch}
              suggestions={currentSuggestions}
              placeholder="Filter by code or description"
            />
            <SortControls title="Sort Not Start" />
          </div>
        </CardHeader>
        <CardContent className="p-0 text-[15px]">
          <ScrollArea className="h-[620px]">
            <div className="divide-y divide-slate-200">
              {filteredCurrent.map((item) => (
                <div
                  key={item.Component_Material}
                  className="grid gap-5 p-4 lg:grid-cols-[1.5fr_1.05fr_1.15fr_0.85fr] lg:items-center"
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
                  <div className="flex flex-col gap-1 text-right text-slate-700 lg:items-end">
                    <span className="text-xs text-slate-500">Total value</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(item.Value || 0)}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right text-slate-700 lg:items-end">
                    <span className="text-xs text-slate-500">Unit price</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(item.Standard_Price || 0)}</span>
                    <span className="text-[12px] text-slate-500">Qty: {item.Total_Qty || 0}</span>
                  </div>
                  <div className="w-full">
                    <Label className="mb-1 block text-xs text-slate-500">Planned start</Label>
                    <DateSelector
                      value={item.Planned_Start}
                      onChange={async (value) => {
                        await updatePlannedStart(item.Component_Material, value);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 text-xs text-slate-600 lg:justify-self-end">
                    <span className="hidden lg:inline">Kanban: {item.Kanban_Flag || '-'}</span>
                    <StatusButton
                      currentStatus={(item.Transfer_Status || 'Not Start') as TransferStatus}
                      onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                    />
                  </div>
                </div>
              ))}
              {filteredCurrent.length === 0 && (
                <div className="p-4 text-sm text-slate-500">No Not Start parts match the search.</div>
              )}
            </div>
          </ScrollArea>
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
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Hold detail</CardTitle>
            <CardDescription>Capture reason and brand for each Not to Transfer item</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <SearchInput
              label="Search"
              value={remainingSearch}
              onChange={setRemainingSearch}
              suggestions={remainingSuggestions}
              placeholder="Filter by code or description"
            />
            <SortControls title="Sort holds" />
          </div>
        </CardHeader>
        <CardContent className="text-[15px]">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {filteredRemaining.map((item) => (
                <div
                  key={item.Component_Material}
                  className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)] lg:items-start"
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
              {filteredRemaining.length === 0 && (
                <div className="p-4 text-sm text-slate-500">No Not to Transfer items match the search.</div>
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
      <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-5 w-5 text-indigo-600" />
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Transfer dashboard</p>
                <p className="text-base font-semibold text-slate-900">Operations view</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Activity className="h-4 w-4 text-emerald-600" />
              Data synced from Firebase
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            {sidebarNav.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={cn(
                    'flex min-w-[12rem] flex-1 items-start gap-2 rounded-xl border px-3 py-3 text-left transition md:min-w-[10rem]',
                    active ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200'
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 text-indigo-600" />
                  <div className="space-y-1">
                    <span className="block font-semibold text-slate-900">{item.label}</span>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <main className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">BoM Transfer Command Center</h1>
            <p className="text-sm text-slate-600">
              Track completions, plans, AU holds, and reporting in one professional view.
            </p>
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  );
}
