import { ManagementReport } from '../models/management-report.model';
import {
  DASHBOARD_BILLING_LABELS,
  DashboardBreakdownItem,
  DashboardDailyPoint,
  DashboardMonthPoint,
  DashboardRequestSummary,
  TimeDashboardFilter,
  TimeDashboardFilterOptions,
  TimeDashboardKpis,
  TimeDashboardPeriodPreset,
  TimeDashboardRange,
  TimeDashboardSnapshot,
} from '../models/time-dashboard.model';
import type { HourBillingCategory, TimeRecordParameters } from './time-record-domain.service';
import { WorkdayHoursPolicy } from './workday-hours.policy';

interface DashboardRow {
  date: string;
  /** Fecha y hora normalizadas para ordenar: `YYYY-MM-DDTHH:mm:ss`. */
  timestamp: string;
  hours: number;
  client: string;
  clientKey: string;
  request: string;
  hourType: string;
  billing: HourBillingCategory;
}

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const NO_CLIENT = 'Sin cliente';
const NO_REQUEST = 'Sin solicitud';
const NO_HOUR_TYPE = 'Sin tipo de hora';

/**
 * Agregaciones del dashboard de tiempos. Puro: recibe filas ya filtradas por
 * propiedad del usuario y devuelve los datos listos para las tarjetas.
 * La facturación se clasifica solo por `tipoHora` (WorkdayHoursPolicy.billingCategory).
 */
export class TimeDashboardCalculator {
  private readonly hoursPolicy: WorkdayHoursPolicy;

  constructor(parameters: TimeRecordParameters) {
    this.hoursPolicy = new WorkdayHoursPolicy(parameters);
  }

  build(records: readonly ManagementReport[], filter: TimeDashboardFilter): TimeDashboardSnapshot {
    if (!this.isValidRange(filter.from, filter.to)) return this.emptySnapshot();
    const rows = this.normalize(records);
    const filtered = this.applyFilter(rows, filter);
    const dayCount = this.daysBetween(filter.from, filter.to).length;
    const previous = this.applyFilter(rows, {
      ...filter,
      from: this.addDays(filter.from, -dayCount),
      to: this.addDays(filter.from, -1),
    });

    return {
      rowCount: filtered.length,
      kpis: this.kpis(filtered, previous, filter),
      daily: this.daily(filtered, filter),
      byClient: this.byClient(filtered),
      billing: this.billing(filtered),
      months: this.months(filtered, filter),
      requests: this.requests(filtered),
    };
  }

  filterOptions(records: readonly ManagementReport[]): TimeDashboardFilterOptions {
    const rows = this.normalize(records);
    return {
      clients: this.unique(rows.map((row) => row.client)),
      hourTypes: this.unique(rows.map((row) => row.hourType)),
    };
  }

  /** Rango de un atajo de periodo que termina en `today` (incluido). */
  presetRange(preset: TimeDashboardPeriodPreset, today: string): TimeDashboardRange {
    if (preset === '7' || preset === '30') {
      return { from: this.addDays(today, -(Number(preset) - 1)), to: today };
    }
    const months = preset === '3m' ? 3 : 6;
    const end = this.parseDate(today);
    // Ajusta el día al último del mes destino para evitar el desborde de setMonth (31 → mes de 30).
    const lastDayOfTarget = new Date(end.getFullYear(), end.getMonth() - months + 1, 0).getDate();
    const start = new Date(
      end.getFullYear(),
      end.getMonth() - months,
      Math.min(end.getDate(), lastDayOfTarget),
      12,
    );
    start.setDate(start.getDate() + 1);
    return { from: this.toDateValue(start), to: today };
  }

  private kpis(
    rows: DashboardRow[],
    previous: DashboardRow[],
    filter: TimeDashboardFilter,
  ): TimeDashboardKpis {
    const totalHours = this.sum(rows);
    const previousPeriodHours = this.sum(previous);
    const billableHours = this.sum(rows.filter((row) => row.billing === 'billable'));
    const expected = this.daysBetween(filter.from, filter.to).map((date) =>
      this.hoursPolicy.expectedHoursForDate(date),
    );
    return {
      totalHours,
      previousPeriodHours,
      variationPct: previousPeriodHours
        ? ((totalHours - previousPeriodHours) / previousPeriodHours) * 100
        : null,
      billableHours,
      billablePct: totalHours ? (billableHours / totalHours) * 100 : 0,
      clientCount: new Set(rows.map((row) => row.client)).size,
      extraHours: this.sum(rows.filter((row) => row.billing === 'factory')),
      reportedDays: new Set(rows.map((row) => row.date)).size,
      expectedDays: expected.filter((hours) => hours > 0).length,
      expectedHours: expected.reduce((total, hours) => total + hours, 0),
    };
  }

  private daily(rows: DashboardRow[], filter: TimeDashboardFilter): DashboardDailyPoint[] {
    const totals = new Map<string, { hours: number; count: number }>();
    rows.forEach((row) => {
      const current = totals.get(row.date) || { hours: 0, count: 0 };
      totals.set(row.date, { hours: current.hours + row.hours, count: current.count + 1 });
    });
    return this.daysBetween(filter.from, filter.to).map((date) => ({
      date,
      label: this.formatDate(date, { day: '2-digit', month: 'short', year: 'numeric' }),
      shortLabel: this.formatDate(date, { day: '2-digit', month: 'short' }),
      ...(totals.get(date) || { hours: 0, count: 0 }),
    }));
  }

  private byClient(rows: DashboardRow[]): DashboardBreakdownItem[] {
    return this.groupBy(rows, (row) => row.client).sort((a, b) => b.hours - a.hours);
  }

  private billing(rows: DashboardRow[]): DashboardBreakdownItem[] {
    const order: HourBillingCategory[] = ['billable', 'factory', 'non_billable'];
    return order
      .map((category) => {
        const items = rows.filter((row) => row.billing === category);
        return {
          label: DASHBOARD_BILLING_LABELS[category],
          hours: this.sum(items),
          count: items.length,
        };
      })
      .filter((item) => item.hours > 0);
  }

  private months(rows: DashboardRow[], filter: TimeDashboardFilter): DashboardMonthPoint[] {
    const keys: string[] = [];
    for (let month = filter.from.slice(0, 7); month <= filter.to.slice(0, 7); ) {
      keys.push(month);
      const [year, value] = month.split('-').map(Number);
      month = value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`;
    }
    return keys.map((month, index, all) => {
      const items = rows.filter((row) => row.date.startsWith(month));
      const total = this.sum(items);
      const previousTotal = index
        ? this.sum(rows.filter((row) => row.date.startsWith(all[index - 1])))
        : 0;
      return {
        month,
        label: this.formatDate(`${month}-01`, { month: 'short', year: 'numeric' }),
        billable: this.sum(items.filter((row) => row.billing === 'billable')),
        factory: this.sum(items.filter((row) => row.billing === 'factory')),
        nonBillable: this.sum(items.filter((row) => row.billing === 'non_billable')),
        total,
        variationPct: previousTotal ? ((total - previousTotal) / previousTotal) * 100 : null,
      };
    });
  }

  private requests(rows: DashboardRow[]): DashboardRequestSummary[] {
    const groups = new Map<string, DashboardRow[]>();
    rows.forEach((row) => {
      const key = JSON.stringify([row.clientKey, row.request]);
      const items = groups.get(key);
      if (items) items.push(row);
      else groups.set(key, [row]);
    });
    return [...groups.entries()]
      .map(([key, items]) => {
        const timestamps = items.map((row) => row.timestamp).sort();
        const days = new Set(items.map((row) => row.date));
        const summary: DashboardRequestSummary = {
          key,
          request: items[0].request,
          client: items[0].client,
          hours: this.sum(items),
          count: items.length,
          latestAt: timestamps[timestamps.length - 1],
          firstAt: timestamps[0],
          activeDays: days.size,
          billing: this.billing(items),
          // TODO(estimaciones): conectar aquí la fuente de horas estimadas por solicitud
          // (clave `key` = cliente + solicitud) y calcular consumptionPct = hours / estimadas × 100.
          estimatedHours: null,
          consumptionPct: null,
        };
        return summary;
      })
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt) || b.hours - a.hours);
  }

  private normalize(records: readonly ManagementReport[]): DashboardRow[] {
    return records.flatMap((record) => {
      const date =
        String(record.fechaInicio || '').match(DATE_PATTERN)?.[0] ||
        String(record.HoraInicio || '').match(DATE_PATTERN)?.[0] ||
        '';
      if (!date) return [];
      const hours = Number(record.tiempoRealHoras);
      const client =
        this.text(record.solicitud_tiemposConsultores?.solicitud_cliente?.nombre) ||
        this.text(record.cliente) ||
        NO_CLIENT;
      const tipoHora = this.text(record.tipoHora);
      return [
        {
          date,
          timestamp: `${date}T${this.timeOf(record.HoraInicio)}`,
          hours: Number.isFinite(hours) && hours > 0 ? hours : 0,
          client,
          clientKey: this.text(record.cliente) || client,
          request: this.text(record.solicitud) || NO_REQUEST,
          hourType: tipoHora || NO_HOUR_TYPE,
          billing: this.hoursPolicy.billingCategory(tipoHora),
        },
      ];
    });
  }

  private applyFilter(rows: DashboardRow[], filter: TimeDashboardFilter): DashboardRow[] {
    return rows.filter(
      (row) =>
        row.date >= filter.from &&
        row.date <= filter.to &&
        (!filter.client || row.client === filter.client) &&
        (!filter.hourType || row.hourType === filter.hourType),
    );
  }

  private groupBy(
    rows: DashboardRow[],
    labelOf: (row: DashboardRow) => string,
  ): DashboardBreakdownItem[] {
    const groups = new Map<string, DashboardBreakdownItem>();
    rows.forEach((row) => {
      const label = labelOf(row);
      const current = groups.get(label) || { label, hours: 0, count: 0 };
      groups.set(label, { label, hours: current.hours + row.hours, count: current.count + 1 });
    });
    return [...groups.values()];
  }

  /** `HoraInicio` llega como `H:mm:ss` sin relleno ("7:30:00") o dentro de un ISO. */
  private timeOf(value: unknown): string {
    const match = String(value || '').match(/(?:^|T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return '00:00:00';
    return `${match[1].padStart(2, '0')}:${match[2]}:${match[3] || '00'}`;
  }

  private emptySnapshot(): TimeDashboardSnapshot {
    return {
      rowCount: 0,
      kpis: {
        totalHours: 0,
        previousPeriodHours: 0,
        variationPct: null,
        billableHours: 0,
        billablePct: 0,
        clientCount: 0,
        extraHours: 0,
        reportedDays: 0,
        expectedDays: 0,
        expectedHours: 0,
      },
      daily: [],
      byClient: [],
      billing: [],
      months: [],
      requests: [],
    };
  }

  private isValidRange(from: string, to: string): boolean {
    const valid = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) && this.toDateValue(this.parseDate(value)) === value;
    return valid(from) && valid(to) && from <= to;
  }

  private daysBetween(from: string, to: string): string[] {
    const days: string[] = [];
    for (let date = from; date <= to; date = this.addDays(date, 1)) days.push(date);
    return days;
  }

  private addDays(value: string, days: number): string {
    const date = this.parseDate(value);
    date.setDate(date.getDate() + days);
    return this.toDateValue(date);
  }

  private parseDate(value: string): Date {
    return new Date(`${value}T12:00:00`);
  }

  private toDateValue(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('es-CO', options).format(this.parseDate(value));
  }

  private sum(rows: DashboardRow[]): number {
    return rows.reduce((total, row) => total + row.hours, 0);
  }

  private text(value: unknown): string {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }
}
