import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/shared/ui/chart';
import type {
  DashboardBreakdownItem,
  DashboardDailyPoint,
  DashboardMonthPoint,
} from '@domain/time-records/models/time-dashboard.model';
import { DASHBOARD_BILLING_LABELS } from '@domain/time-records/models/time-dashboard.model';
import { BILLING_COLORS, billingColor, formatHours, formatSigned } from './dashboard-format';
import { seriesColor, type TrendPoint } from './dashboard-insights';

const hoursConfig = { hours: { label: 'Horas', color: 'var(--chart-1)' } } satisfies ChartConfig;
const BAR_ROW_HEIGHT = 32;
const hoursTooltip = (value: unknown) => <span className="tabular-nums">{formatHours(Number(value))} h</span>;
const gradientId = (uid: string) => `fill-${uid.replace(/:/g, '')}`;

/** Degradado vertical de un área: del color de la serie a casi transparente. */
function AreaGradient({ id, color }: { readonly id: string; readonly color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={color} stopOpacity={0.35} />
        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

/** Horas por día de todo el rango (área con degradado), incluidos los días sin reportes, y la meta diaria. */
export function DailyHoursChart({ data, goal }: { readonly data: readonly DashboardDailyPoint[]; readonly goal?: number }) {
  const gid = gradientId(useId());
  return (
    <ChartContainer config={hoursConfig} className="aspect-auto h-64 w-full" aria-label="Horas reportadas por día del periodo">
      <AreaChart accessibilityLayer data={[...data]} margin={{ left: 0, right: 8, top: 8 }}>
        <AreaGradient id={gid} color="var(--color-hours)" />
        <CartesianGrid vertical={false} />
        <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis
          width={32}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          domain={[0, (max: number) => Math.max(Math.ceil(max), goal ?? 0)]}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label ?? '')}
              formatter={(value, _name, item) => (
                <span className="tabular-nums">
                  {formatHours(Number(value))} h · {item.payload.count} {item.payload.count === 1 ? 'registro' : 'registros'}
                </span>
              )}
            />
          }
        />
        {goal ? (
          <ReferenceLine
            y={goal}
            stroke="var(--chart-3)"
            strokeDasharray="4 4"
            label={{ value: `Meta ${formatHours(goal)} h`, position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
        ) : null}
        <Area isAnimationActive={false} type="monotone" dataKey="hours" stroke="var(--color-hours)" strokeWidth={2} fill={`url(#${gid})`} dot={false} />
      </AreaChart>
    </ChartContainer>
  );
}

/** Sparkline de horas (sin ejes ni rejilla) para KPIs y tendencias cortas. */
export function HoursSparkline({
  data,
  color = 'var(--chart-1)',
  label,
  className = 'h-10',
}: {
  readonly data: readonly Pick<TrendPoint, 'label' | 'hours'>[];
  readonly color?: string;
  readonly label: string;
  readonly className?: string;
}) {
  const gid = gradientId(useId());
  const config = { hours: { label: 'Horas', color } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className={`aspect-auto w-full ${className}`} aria-label={label}>
      <AreaChart data={[...data]} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <AreaGradient id={gid} color="var(--color-hours)" />
        <XAxis dataKey="label" hide />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => hoursTooltip(value)} />}
        />
        <Area isAnimationActive={false} type="monotone" dataKey="hours" stroke="var(--color-hours)" strokeWidth={1.5} fill={`url(#${gid})`} dot={false} />
      </AreaChart>
    </ChartContainer>
  );
}

/** Horas por grupo (cliente por defecto), de mayor a menor, un color por barra; la altura crece con el número de grupos. */
export function ClientHoursChart({ data, label = 'Horas por cliente' }: { readonly data: readonly DashboardBreakdownItem[]; readonly label?: string }) {
  return (
    <ChartContainer
      config={hoursConfig}
      className="aspect-auto w-full"
      style={{ height: Math.max(180, data.length * BAR_ROW_HEIGHT + 24) }}
      aria-label={label}
    >
      <BarChart accessibilityLayer data={[...data]} layout="vertical" margin={{ left: 0, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={104}
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => <span className="tabular-nums">{String(item.payload.label)}: {formatHours(Number(value))} h</span>} />} />
        <Bar isAnimationActive={false} dataKey="hours" radius={4}>
          {data.map((item, index) => (
            <Cell key={item.label} fill={seriesColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export interface DonutItem {
  readonly label: string;
  readonly hours: number;
  readonly share: number;
}

/**
 * Dona con el total al centro y una leyenda (lista) con horas y %. La lista es también la
 * alternativa textual de la gráfica.
 */
export function DonutChart({
  data,
  label,
  colorOf = (_item, index) => seriesColor(index),
}: {
  readonly data: readonly DonutItem[];
  readonly label: string;
  readonly colorOf?: (item: DonutItem, index: number) => string;
}) {
  const total = data.reduce((sum, item) => sum + item.hours, 0);
  const config = Object.fromEntries(data.map((item, index) => [`s${index}`, { label: item.label, color: colorOf(item, index) }])) satisfies ChartConfig;
  const slices = data.map((item, index) => ({ ...item, key: `s${index}` }));
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <ChartContainer config={config} className="aspect-auto h-52 w-full" aria-label={label}>
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => (
                    <span className="tabular-nums">
                      {String(item.payload.label)}: {formatHours(Number(value))} h
                    </span>
                  )}
                />
              }
            />
            <Pie isAnimationActive={false} data={slices} dataKey="hours" nameKey="key" innerRadius="62%" outerRadius="90%" paddingAngle={2} cornerRadius={4} strokeWidth={0}>
              {slices.map((item) => (
                <Cell key={item.key} fill={`var(--color-${item.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{formatHours(total)}</span>
          <span className="text-xs text-muted-foreground">horas</span>
        </div>
      </div>
      <ul className="grid gap-1.5 text-xs sm:grid-cols-2" aria-label={`${label}: detalle`}>
        {slices.map((item, index) => (
          <li key={item.key} className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: colorOf(item, index) }} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatHours(item.hours)} h · {formatHours(item.share)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dona de facturable, Fábrica y no facturable. */
export function BillingChart({ data }: { readonly data: readonly DashboardBreakdownItem[] }) {
  const total = data.reduce((sum, item) => sum + item.hours, 0);
  const items = data.map((item) => ({ ...item, share: total ? (item.hours / total) * 100 : 0 }));
  return <DonutChart data={items} label="Horas facturables, de fábrica y no facturables" colorOf={(item) => billingColor(item.label)} />;
}

/** Gauge radial del cumplimiento (0-100 %, lo que exceda se recorta); el % va al centro. */
export function ComplianceGauge({ pct, label }: { readonly pct: number; readonly label: string }) {
  const value = Math.max(0, Math.min(100, pct));
  const color = pct >= 100 ? 'var(--chart-2)' : 'var(--chart-1)';
  const config = { value: { label: 'Cumplimiento', color } } satisfies ChartConfig;
  return (
    <div className="relative mx-auto size-40 shrink-0">
      <ChartContainer config={config} className="aspect-square size-full" aria-label={label}>
        <RadialBarChart data={[{ name: 'Cumplimiento', value }]} startAngle={90} endAngle={-270} innerRadius="72%" outerRadius="100%" barSize={14}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar isAnimationActive={false} dataKey="value" background cornerRadius={8} fill="var(--color-value)" />
        </RadialBarChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums">{formatHours(pct, 0)}%</span>
        <span className="text-xs text-muted-foreground">de la jornada</span>
      </div>
    </div>
  );
}

const monthsConfig = {
  billable: { label: DASHBOARD_BILLING_LABELS.billable, color: BILLING_COLORS.billable },
  factory: { label: DASHBOARD_BILLING_LABELS.factory, color: BILLING_COLORS.factory },
  nonBillable: { label: DASHBOARD_BILLING_LABELS.non_billable, color: BILLING_COLORS.nonBillable },
} satisfies ChartConfig;

/** Comparativo mes a mes apilado; la variación frente al mes anterior va en el título del tooltip. */
export function MonthlyChart({ data }: { readonly data: readonly DashboardMonthPoint[] }) {
  const points = data.map((month) => ({
    ...month,
    tooltipLabel: month.variationPct === null ? month.label : `${month.label} · ${formatSigned(month.variationPct)} %`,
  }));
  return (
    <ChartContainer config={monthsConfig} className="aspect-auto h-64 w-full" aria-label="Horas por mes según clasificación de facturación">
      <BarChart accessibilityLayer data={points} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} tickFormatter={(value: string) => value.replace(/ de 20/, " '")} />
        <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.tooltipLabel ?? '')} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar isAnimationActive={false} dataKey="billable" stackId="month" fill="var(--color-billable)" />
        <Bar isAnimationActive={false} dataKey="factory" stackId="month" fill="var(--color-factory)" />
        <Bar isAnimationActive={false} dataKey="nonBillable" stackId="month" fill="var(--color-nonBillable)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
