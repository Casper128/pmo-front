import type { HourBillingCategory } from '../services/time-record-domain.service';

/** Filtros del dashboard. Cadena vacía en `client` u `hourType` significa "todos". */
export interface TimeDashboardFilter {
  from: string;
  to: string;
  client: string;
  hourType: string;
}

export type TimeDashboardPeriodPreset = '7' | '30' | '3m' | '6m';

export interface TimeDashboardRange {
  from: string;
  to: string;
}

export interface TimeDashboardKpis {
  totalHours: number;
  previousPeriodHours: number;
  /** null cuando el periodo anterior no tiene horas. */
  variationPct: number | null;
  billableHours: number;
  /** 0..100 */
  billablePct: number;
  clientCount: number;
  /** Horas de registros con tipo de hora Fábrica. */
  extraHours: number;
  reportedDays: number;
  expectedDays: number;
  expectedHours: number;
}

/** Misma forma que espera `weekly-hours-chart`. */
export interface DashboardDailyPoint {
  date: string;
  label: string;
  shortLabel: string;
  hours: number;
  count: number;
}

/** Misma forma estructural que `StatisticsChartItem`. */
export interface DashboardBreakdownItem {
  label: string;
  hours: number;
  count: number;
}

export interface DashboardRequestSummary {
  key: string;
  request: string;
  client: string;
  hours: number;
  count: number;
  /** Fecha y hora del registro más reciente (`YYYY-MM-DDTHH:mm:ss`). */
  latestAt: string;
  /** Fecha y hora del registro más antiguo dentro del periodo. */
  firstAt: string;
  /** Días distintos con actividad en el periodo. */
  activeDays: number;
  /** Horas por clasificación de facturación (solo categorías con horas). */
  billing: DashboardBreakdownItem[];
  estimatedHours: number | null;
  /** Horas reales / estimadas × 100; null sin estimación. */
  consumptionPct: number | null;
}

export interface DashboardMonthPoint {
  month: string;
  label: string;
  billable: number;
  factory: number;
  nonBillable: number;
  total: number;
  /** Variación frente al mes anterior de la serie; null en el primero o si el anterior es 0. */
  variationPct: number | null;
}

export interface TimeDashboardSnapshot {
  rowCount: number;
  kpis: TimeDashboardKpis;
  daily: DashboardDailyPoint[];
  byClient: DashboardBreakdownItem[];
  billing: DashboardBreakdownItem[];
  months: DashboardMonthPoint[];
  /** Solicitudes (cliente + solicitud) del periodo, de la más reciente a la más antigua. */
  requests: DashboardRequestSummary[];
}

export interface TimeDashboardFilterOptions {
  clients: string[];
  hourTypes: string[];
}

export const DASHBOARD_BILLING_LABELS: Record<HourBillingCategory, string> = {
  billable: 'Facturable',
  factory: 'Fábrica',
  non_billable: 'No facturable',
};
