import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { ComplianceGauge, HoursSparkline } from './dashboard-charts';
import { formatHours } from './dashboard-format';
import type { ComplianceSummary, TrendPoint } from './dashboard-insights';

const ROWS = [
  { key: 'fullDays', label: 'Días completos', color: 'var(--chart-2)' },
  { key: 'incompleteDays', label: 'Días incompletos', color: 'var(--chart-3)' },
  { key: 'missingDays', label: 'Días sin reporte', color: 'var(--chart-5)' },
] as const;

export interface ComplianceCardProps {
  readonly summary: ComplianceSummary;
  /** Horas de los últimos días, para la tendencia; vacío la oculta. */
  readonly trend?: readonly TrendPoint[];
  readonly description?: string;
  readonly className?: string;
}

/** Cumplimiento de jornada: gauge de horas reportadas vs esperadas, días por estado y tendencia reciente. */
export function ComplianceCard({ summary, trend = [], description = 'Horas reportadas frente a las esperadas del periodo.', className }: ComplianceCardProps) {
  const pct = formatHours(summary.pct);
  return (
    <Card className={className} aria-labelledby="compliance-title" role="region">
      <CardHeader>
        <CardTitle id="compliance-title">Cumplimiento de jornada</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <ComplianceGauge pct={summary.pct} label={`Cumplimiento de jornada: ${pct} %`} />
          <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm tabular-nums">
              <span className="font-semibold">{formatHours(summary.reportedHours)} h</span>
              <span className="text-muted-foreground"> de {formatHours(summary.expectedHours)} h esperadas</span>
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {ROWS.map(({ key, label, color }) => (
                <li key={key} className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                  <span className="flex-1 text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums">{summary[key]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {trend.length > 1 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Últimos {trend.length} días</p>
            <HoursSparkline data={trend} color="var(--chart-4)" label={`Horas de los últimos ${trend.length} días`} className="h-14" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
