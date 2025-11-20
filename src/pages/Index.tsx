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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);

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
  | 'notToTransfer'
  | 'report';

const sidebarNav: { key: TabKey; label: string; description: string; icon: typeof Activity }[] = [
  { key: 'completed', label: '已完成', description: '完成统计与价值', icon: BadgeCheck },
  { key: 'plan', label: 'Plan (In Progress)', description: '预计完成计划', icon: NotebookPen },
  { key: 'current', label: 'Current BoM (parts)', description: '当前库存走势', icon: Layers },
  { key: 'remaining', label: 'Remaining in AU', description: '未转移库存', icon: Factory },
  { key: 'notToTransfer', label: 'Not to Transfer', description: '保留原因与品牌', icon: Flag },
  { key: 'report', label: 'Report', description: '生成阶段报告', icon: FilePieChart },
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
          {parsed ? format(parsed, 'PP') : '选择日期'}
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
  } = useBomData();
  const [activeTab, setActiveTab] = useState<TabKey>('completed');

  const completedItems = useMemo(
    () => bomItems.filter((item) => (item.Transfer_Status || 'Not Start') === 'Finished'),
    [bomItems]
  );

  const planItems = useMemo(
    () =>
      bomItems.filter((item) => {
        const status = (item.Transfer_Status || 'Not Start') as TransferStatus;
        return status === 'In Progress' || status === 'Not Start';
      }),
    [bomItems]
  );

  const currentBomItems = useMemo(
    () => bomItems.filter((item) => (item.Transfer_Status || 'Not Start') !== 'Not to Transfer'),
    [bomItems]
  );

  const remainingItems = useMemo(
    () => bomItems.filter((item) => (item.Transfer_Status || 'Not Start') === 'Not Start'),
    [bomItems]
  );

  const notToTransferItems = useMemo(
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

  const currentReduction = useMemo(() => {
    const startTotal = currentBomItems.filter(
      (item) => (item.Transfer_Status || 'Not Start') !== 'Finished'
    ).length;

    const orderedMonths = planForecast.length
      ? planForecast
      : [
          {
            month: format(new Date(), 'MMM'),
            sortValue: +startOfMonth(new Date()),
            parts: 0,
            value: 0,
            delayedParts: 0,
          },
        ];

    let remaining = startTotal;
    const result: { month: string; remaining: number; completed: number }[] = [];

    orderedMonths.forEach((entry) => {
      const completed = Math.min(entry.parts, Math.max(remaining, 0));
      remaining = Math.max(remaining - entry.parts, 0);
      result.push({ month: entry.month, remaining, completed });
    });

    return result;
  }, [currentBomItems, planForecast]);

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
        title="已完成"
        description="完成数量、价值与最后国内采购月份走势"
        icon={BadgeCheck}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">2025 完成数量</CardTitle>
            <CardDescription className="text-3xl font-semibold text-slate-900">
              {completed2025.length} parts
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">2025 价值节省</CardTitle>
            <CardDescription className="text-3xl font-semibold text-emerald-600">
              {formatCurrency(
                completed2025.reduce((sum, item) => sum + (item.Value || 0), 0)
              )}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">总完成率</CardTitle>
            <CardDescription className="text-3xl font-semibold text-indigo-600">
              {Math.round((summary.completedParts / Math.max(summary.totalParts, 1)) * 100)}%
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className={professionalPalette.surface}>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>完成分布 (基于最新国内采购日期)</CardTitle>
            <CardDescription>数量与价值分别使用独立坐标系</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            2025
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ChartContainer
              config={{
                count: { label: '数量', color: 'hsl(215, 85%, 55%)' },
                value: { label: '价值', color: 'hsl(158, 70%, 45%)' },
              }}
            >
              <ResponsiveContainer>
                <ComposedChart data={completedChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" label={{ value: '数量', angle: -90, position: 'insideLeft' }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    label={{ value: '总价值', angle: 90, position: 'insideRight' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="count"
                    name="数量"
                    barSize={28}
                    fill="var(--color-count)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="value"
                    name="总价值"
                    barSize={28}
                    fill="var(--color-value)"
                    radius={[6, 6, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>已完成清单</CardTitle>
          <CardDescription>透明展示每个完成件的价值与采购月份</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {completedItems.map((item) => {
              const lastBuy = parseDate(item.Latest_Component_Date);
              return (
                <div
                  key={item.Component_Material}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">
                      {item.Component_Material}
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700">Finished</Badge>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {item.Description_EN}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                    <span>{formatCurrency(item.Value || 0)}</span>
                    <span>{lastBuy ? format(lastBuy, 'MMM yyyy') : 'N/A'}</span>
                  </div>
                </div>
              );
            })}
            {completedItems.length === 0 && (
              <div className="text-sm text-slate-500">暂无完成记录。</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPlan = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Plan (In Progress)"
        description="登记预计完成时间，预测月度完成数量与价值"
        icon={NotebookPen}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">在制 + 待启动</CardTitle>
            <CardDescription className="text-3xl font-semibold text-slate-900">
              {planItems.length} parts
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">已登记预计完成</CardTitle>
            <CardDescription className="text-3xl font-semibold text-indigo-600">
              {planForecast.reduce((sum, item) => sum + item.parts, 0)} parts
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={professionalPalette.surface}>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">延后项</CardTitle>
            <CardDescription className="text-3xl font-semibold text-amber-600">
              {delayedCount} parts
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>月度完成趋势 (预测)</CardTitle>
          <CardDescription>叠加价值与预计完成数量，识别延误</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ChartContainer
              config={{
                parts: { label: '预计完成数量', color: 'hsl(215, 80%, 55%)' },
                value: { label: '预计价值', color: 'hsl(221, 39%, 11%)' },
                delayed: { label: '延后数量', color: 'hsl(34, 94%, 50%)' },
              }}
            >
              <ResponsiveContainer>
                <ComposedChart data={planForecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="parts"
                    name="数量"
                    stackId="a"
                    fill="var(--color-parts)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="delayedParts"
                    name="延后"
                    stackId="a"
                    fill="var(--color-delayed)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    yAxisId="right"
                    dataKey="value"
                    name="价值"
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
          <CardTitle>计划明细</CardTitle>
          <CardDescription>登记预计完成日期，自动同步 Firebase</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {planItems.map((item) => {
              const expected = parseDate(item.Expected_Completion);
              const isDelayed = expected ? isBefore(expected, new Date()) : false;
              return (
                <div key={item.Component_Material} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">
                      {item.Component_Material}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.Transfer_Status || 'Not Start'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                  <div className="mt-3">
                    <Label className="text-xs text-slate-500">预计完成日期</Label>
                    <DateSelector
                      value={item.Expected_Completion}
                      onChange={async (date) => {
                        await updateExpectedCompletion(item.Component_Material, date);
                      }}
                    />
                    {isDelayed && (
                      <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" /> 已延后
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>价值 {formatCurrency(item.Value || 0)}</span>
                    <StatusButton
                      currentStatus={item.Transfer_Status || 'Not Start'}
                      onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                    />
                  </div>
                </div>
              );
            })}
            {planItems.length === 0 && (
              <p className="text-sm text-slate-500">暂无计划项。</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCurrent = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Current BoM (parts)"
        description="不含 Not to Transfer，展示库存下降趋势"
        icon={Layers}
      />

      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>月度减少趋势</CardTitle>
          <CardDescription>基于计划完成数，预估当前 BoM 的下降曲线</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ChartContainer
              config={{
                remaining: { label: '剩余件数', color: 'hsl(215, 80%, 50%)' },
                completed: { label: '当月完成', color: 'hsl(142, 71%, 45%)' },
              }}
            >
              <ResponsiveContainer>
                <ComposedChart data={currentReduction}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="remaining"
                    name="剩余件数"
                    stroke="var(--color-remaining)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                  <Bar
                    dataKey="completed"
                    name="当月完成"
                    fill="var(--color-completed)"
                    radius={[6, 6, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>当前 BoM 清单</CardTitle>
          <CardDescription>侧重正在转移或未开始的件，排除 Not to Transfer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentBomItems.map((item) => (
              <div key={item.Component_Material} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{item.Component_Material}</div>
                  <Badge variant="outline" className="text-xs">
                    {item.Transfer_Status || 'Not Start'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Kanban: {item.Kanban_Flag || '-'}</span>
                  <span>价值 {formatCurrency(item.Value || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderRemaining = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Remaining in AU"
        description="突出仍在澳洲的库存，便于拉通行动"
        icon={Factory}
      />
      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>未启动件</CardTitle>
          <CardDescription>默认依据 Not Start 状态识别</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {remainingItems.map((item) => (
              <div key={item.Component_Material} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{item.Component_Material}</div>
                  <Badge variant="outline" className="text-xs">AU Remaining</Badge>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>价值 {formatCurrency(item.Value || 0)}</span>
                  <StatusButton
                    currentStatus={item.Transfer_Status || 'Not Start'}
                    onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                  />
                </div>
              </div>
            ))}
            {remainingItems.length === 0 && (
              <p className="text-sm text-slate-500">暂无未启动件。</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderNotToTransfer = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Not to Transfer"
        description="为每个保留件补充品牌与原因，确保清晰决策轨迹"
        icon={Flag}
      />

      <Card className={professionalPalette.surface}>
        <CardHeader>
          <CardTitle>保留件详情</CardTitle>
          <CardDescription>填写 reason 与 brand，实时写入 Firebase</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {notToTransferItems.map((item) => (
              <div key={item.Component_Material} className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{item.Component_Material}</div>
                  <Badge variant="outline" className="text-xs">Not to Transfer</Badge>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{item.Description_EN}</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Reason</Label>
                    <Input
                      defaultValue={item.NotToTransferReason}
                      placeholder="e.g. Localized sourcing"
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
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>价值 {formatCurrency(item.Value || 0)}</span>
                  <StatusButton
                    currentStatus={item.Transfer_Status || 'Not Start'}
                    onStatusChange={(status) => updateStatus(item.Component_Material, status)}
                  />
                </div>
              </div>
            ))}
            {notToTransferItems.length === 0 && (
              <p className="text-sm text-slate-500">暂无 Not to Transfer 记录。</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderReport = () => (
    <div className="space-y-6">
      <SectionHeader
        title="Report"
        description="一键生成当前阶段报告，覆盖完成率、价值与风险"
        icon={FilePieChart}
      />

      <Card className={professionalPalette.surface}>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>阶段概览</CardTitle>
            <CardDescription>摘要覆盖完成、价值、延后风险与当前库存</CardDescription>
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
            导出报告
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">完成率</div>
              <div className="text-2xl font-semibold text-slate-900">
                {Math.round((summary.completedParts / Math.max(summary.totalParts, 1)) * 100)}%
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">完成价值</div>
              <div className="text-2xl font-semibold text-emerald-600">
                {formatCurrency(summary.completedValue)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">延后计划</div>
              <div className="text-2xl font-semibold text-amber-600">{delayedCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">当前 BoM (含在途)</div>
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
      case 'notToTransfer':
        return renderNotToTransfer();
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
              <p className="text-xs uppercase tracking-wide text-slate-500">Transfer Studio</p>
              <p className="text-base font-semibold text-slate-900">Professional View</p>
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
                精准跟踪完成、计划、Not to Transfer 与报告输出，让交付更专业。
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Activity className="h-4 w-4 text-emerald-600" />
              实时同步 Firebase
            </div>
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  );
}
