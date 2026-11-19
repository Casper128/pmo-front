import type { DashboardBreakdownItem, DashboardDailyPoint } from '@domain/time-records/models/time-dashboard.model';
import type { MetricDelta } from '@presentation/shared/components/metric-card';
import { formatSigned } from './dashboard-format';

/** Horas esperadas de una fecha `YYYY-MM-DD` según la jornada configurada. */
export type ExpectedHoursFor = (date: string) => number;

export interface ComplianceSummary {
  readonly expectedHours: number;
  readonly reportedHours: number;
  /** Horas reportadas / esperadas × 100; puede superar 100. 0 sin horas esperadas. */
  readonly pct: number;
  readonly fullDays: number;
  readonly incompleteDays: number;
  readonly missingDays: number;
}

export interface TrendPoint {
  readonly date: string;
  readonly label: string;
  readonly hours: number;
}

export interface ShareItem extends DashboardBreakdownItem {
  readonly share: number;
}

/** Delta de un KPI frente al periodo anterior equivalente; `undefined` si no hay base de comparación. */
export function buildDelta(variationPct: number | null): MetricDelta | undefined {
  if (variationPct === null) return undefined;
  return {
    label: `${formatSigned(variationPct)} %`,
    trend: variationPct > 0 ? 'up' : variationPct < 0 ? 'down' : 'neutral',
    description: 'frente al periodo anterior',
  };
}

/**
 * Cumplimiento de jornada: horas reportadas vs esperadas del periodo y días laborables completos,
 * incompletos y sin reporte (los días sin horas esperadas no cuentan).
 */
export function complianceSummary(daily: readonly DashboardDailyPoint[], expectedFor: ExpectedHoursFor): ComplianceSummary {
  let expectedHours = 0;
  let fullDays = 0;
  let incompleteDays = 0;
  let missingDays = 0;
  for (const point of daily) {
    const expected = expectedFor(point.date);
    expectedHours += expected;
    if (expected <= 0) continue;
    if (point.hours >= expected) fullDays += 1;
    else if (point.hours > 0) incompleteDays += 1;
    else missingDays += 1;
  }
  const reportedHours = daily.reduce((total, point) => total + point.hours, 0);
  return {
    expectedHours,
    reportedHours,
    pct: expectedHours > 0 ? (reportedHours / expectedHours) * 100 : 0,
    fullDays,
    incompleteDays,
    missingDays,
  };
}

/** Últimos `count` días del rango, para la tendencia corta. */
export function lastDays(daily: readonly DashboardDailyPoint[], count = 7): TrendPoint[] {
  return daily.slice(-count).map(({ date, shortLabel, hours }) => ({ date, label: shortLabel, hours }));
}

/** Los `limit` mayores grupos con su % del total; el resto se agrupa en "Otros". */
export function topWithOthers(items: readonly DashboardBreakdownItem[], limit = 5): ShareItem[] {
  const total = items.reduce((sum, item) => sum + item.hours, 0);
  const share = (hours: number) => (total > 0 ? (hours / total) * 100 : 0);
  const sorted = [...items].sort((a, b) => b.hours - a.hours);
  if (sorted.length <= limit) return sorted.map((item) => ({ ...item, share: share(item.hours) }));
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  const hours = rest.reduce((sum, item) => sum + item.hours, 0);
  const count = rest.reduce((sum, item) => sum + item.count, 0);
  return [...head.map((item) => ({ ...item, share: share(item.hours) })), { label: 'Otros', hours, count, share: share(hours) }];
}

/** Color de la serie `index` (0-based), cíclico sobre `--chart-1..5`. */
export const seriesColor = (index: number): string => `var(--chart-${(index % 5) + 1})`;
