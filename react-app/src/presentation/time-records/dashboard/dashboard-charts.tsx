import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
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
import { formatHours, formatSigned } from './dashboard-format';

const hoursConfig = { hours: { label: 'Horas', color: 'var(--chart-1)' } } satisfies ChartConfig;
const BAR_ROW_HEIGHT = 32;

/** Horas por día de todo el rango, incluidos los días sin reportes. */
export function DailyHoursChart({ data }: { readonly data: readonly DashboardDailyPoint[] }) {
  return (
    <ChartContainer config={hoursConfig} className="aspect-auto h-64 w-full" aria-label="Horas reportadas por día del periodo">
      <BarChart accessibilityLayer data={[...data]} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
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
        <Bar isAnimationActive={false} dataKey="hours" fill="var(--color-hours)" radius={3} />
      </BarChart>
    </ChartContainer>
  );
}

/** Horas por cliente, de mayor a menor; la altura crece con el número de clientes. */
export function ClientHoursChart({ data }: { readonly data: readonly DashboardBreakdownItem[] }) {
  return (
    <ChartContainer
      config={hoursConfig}
      className="aspect-auto w-full"
      style={{ height: Math.max(180, data.length * BAR_ROW_HEIGHT + 24) }}
      aria-label="Horas por cliente"
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
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => <span className="tabular-nums">{formatHours(Number(value))} h</span>} />}
        />
        <Bar isAnimationActive={false} dataKey="hours" fill="var(--color-hours)" radius={3} />
      </BarChart>
    </ChartContainer>
  );
}

const billingConfig = {
  billable: { label: DASHBOARD_BILLING_LABELS.billable, color: 'var(--chart-1)' },
  factory: { label: DASHBOARD_BILLING_LABELS.factory, color: 'var(--chart-3)' },
  nonBillable: { label: DASHBOARD_BILLING_LABELS.non_billable, color: 'var(--chart-4)' },
} satisfies ChartConfig;

/** Clave de color de `billingConfig` según la etiqueta del dominio (los nombres de variable CSS no admiten espacios). */
const billingKey = (label: string): keyof typeof billingConfig =>
  label === DASHBOARD_BILLING_LABELS.factory ? 'factory' : label === DASHBOARD_BILLING_LABELS.non_billable ? 'nonBillable' : 'billable';

/** Dona de facturable, Fábrica y no facturable. */
export function BillingChart({ data }: { readonly data: readonly DashboardBreakdownItem[] }) {
  const slices = data.map((item) => ({ ...item, key: billingKey(item.label) }));
  return (
    <ChartContainer config={billingConfig} className="aspect-auto h-64 w-full" aria-label="Horas facturables, de fábrica y no facturables">
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
        <Pie isAnimationActive={false} data={slices} dataKey="hours" nameKey="key" innerRadius={52} strokeWidth={2}>
          {slices.map((item) => (
            <Cell key={item.key} fill={`var(--color-${item.key})`} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="key" />} />
      </PieChart>
    </ChartContainer>
  );
}

const monthsConfig = {
  billable: { label: DASHBOARD_BILLING_LABELS.billable, color: 'var(--chart-1)' },
  factory: { label: DASHBOARD_BILLING_LABELS.factory, color: 'var(--chart-3)' },
  nonBillable: { label: DASHBOARD_BILLING_LABELS.non_billable, color: 'var(--chart-4)' },
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
