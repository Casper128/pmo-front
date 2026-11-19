import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { normalizeText, parseDateValue, toDateValue } from '@presentation/shared/format';
import { NO_DAY_KEY, reportTime, toReportView, type IsCountable, type ReportView } from './report-view';

export type ReportPreset = 'today' | 'week' | 'month' | '3m' | 'custom';

export const DEFAULT_REPORT_PRESET: ReportPreset = 'month';

export const REPORT_PRESETS: readonly { value: ReportPreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: '3m', label: '3 meses' },
  { value: 'custom', label: 'Personalizado' },
];

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

/** Rango de un preset respecto a `today` (`YYYY-MM-DD`): semana de lunes a domingo, mes calendario, 3 meses hasta hoy. */
export function reportPresetRange(preset: Exclude<ReportPreset, 'custom'>, today: string): DateRange {
  const day = parseDateValue(today) ?? new Date();
  const range = (from: Date, to: Date) => ({ from: toDateValue(from), to: toDateValue(to) });
  switch (preset) {
    case 'today':
      return range(day, day);
    case 'week':
      return range(startOfWeek(day, { weekStartsOn: 1 }), endOfWeek(day, { weekStartsOn: 1 }));
    case 'month':
      return range(startOfMonth(day), endOfMonth(day));
    case '3m':
      return range(addDays(subMonths(day, 3), 1), day);
  }
}

/** Reporte enviado listo para listar, buscar y agrupar. */
export interface ReportRow {
  readonly report: ManagementReport;
  readonly view: ReportView;
  /** `HH:mm`; vacío si el reporte no trae horario. */
  readonly start: string;
  readonly end: string;
  readonly clientName: string;
  readonly managementName: string;
  readonly tipoHora: string;
  /** Horas reportadas (también las de Fábrica, que no computan). */
  readonly hours: number;
  readonly description: string;
  readonly searchText: string;
}

export function toReportRow(report: ManagementReport, isCountable: IsCountable): ReportRow {
  const hours = Number(report.tiempoRealHoras || 0);
  const clientName = report.solicitud_tiemposConsultores?.solicitud_cliente?.nombre || report.cliente || 'Sin cliente';
  const managementName =
    report.solicitud_tiemposConsultores?.nombreGestion || report.solicitud || report.identificador || 'Sin gestión';
  const description = report.descripcionActividad || report.observacion || '';
  return {
    report,
    view: toReportView(report, isCountable),
    start: reportTime(report.HoraInicio),
    end: reportTime(report.HoraFin),
    clientName,
    managementName,
    tipoHora: report.tipoHora || 'Laboral',
    hours: Number.isFinite(hours) ? hours : 0,
    description,
    searchText: normalizeText(
      [report.identificador, description, report.solicitud, managementName, report.funcional, report.tecnologia, report.modulo, clientName].join(' '),
    ),
  };
}

export interface ReportFilter extends DateRange {
  readonly q: string;
  readonly client: string;
}

/** Los reportes sin día (`sin-fecha`) no se pueden ubicar en un rango: pasan el filtro de fechas para que sigan visibles. */
export function filterReportRows(rows: readonly ReportRow[], filter: ReportFilter): ReportRow[] {
  const term = normalizeText(filter.q);
  return rows.filter(({ view, clientName, searchText }) => {
    if (view.dayKey !== NO_DAY_KEY && (view.dayKey < filter.from || view.dayKey > filter.to)) return false;
    if (filter.client && clientName !== filter.client) return false;
    return !term || searchText.includes(term);
  });
}

export interface ReportDay {
  readonly dayKey: string;
  readonly rows: readonly ReportRow[];
  /** Horas computables del día (Fábrica no cuenta). */
  readonly computableHours: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Días del más reciente al más antiguo (registros por hora de inicio); "Sin fecha" al final. */
export function groupReportsByDay(rows: readonly ReportRow[]): ReportDay[] {
  const byDay = new Map<string, ReportRow[]>();
  for (const row of rows) byDay.set(row.view.dayKey, [...(byDay.get(row.view.dayKey) ?? []), row]);
  return [...byDay.entries()]
    .sort(([a], [b]) => (a === NO_DAY_KEY ? 1 : b === NO_DAY_KEY ? -1 : b.localeCompare(a)))
    .map(([dayKey, dayRows]) => ({
      dayKey,
      rows: [...dayRows].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)),
      computableHours: round(dayRows.reduce((sum, row) => sum + row.view.computableHours, 0)),
    }));
}

export type DayStatusKind = 'ok' | 'missing' | 'excess';

/** Horas computables del día frente a la jornada esperada. */
export function dayStatus(computableHours: number, expectedHours: number): { kind: DayStatusKind; difference: number } {
  const difference = round(computableHours - expectedHours);
  return { kind: difference === 0 ? 'ok' : difference < 0 ? 'missing' : 'excess', difference: Math.abs(difference) };
}

export interface ReportSummary {
  readonly count: number;
  readonly days: number;
  readonly computableHours: number;
  /** Horas de Fábrica y otras que no computan. */
  readonly nonComputableHours: number;
}

/** Resumen del rango: los reportes sin fecha se cuentan pero no suman horas ni días. */
export function summarizeReports(days: readonly ReportDay[]): ReportSummary {
  const dated = days.filter((day) => day.dayKey !== NO_DAY_KEY);
  const datedRows = dated.flatMap((day) => day.rows);
  const computableHours = round(dated.reduce((sum, day) => sum + day.computableHours, 0));
  return {
    count: days.reduce((sum, day) => sum + day.rows.length, 0),
    days: dated.length,
    computableHours,
    nonComputableHours: round(datedRows.reduce((sum, row) => sum + row.hours, 0) - computableHours),
  };
}
