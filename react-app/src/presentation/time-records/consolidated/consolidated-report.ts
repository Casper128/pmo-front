import { addDays, subMonths } from 'date-fns';
import type { HourBillingFilter } from '@domain/time-records/services/time-record-domain.service';
import { normalizeText, parseDateValue, toDateValue } from '@presentation/shared/format';

/** Actividad del Excel consolidado, ya normalizada. */
export interface ConsolidatedRow {
  readonly identificador: string;
  readonly solicitud: string;
  readonly categoria: string;
  readonly cliente: string;
  readonly consultor: string;
  readonly descripcion: string;
  readonly horas: number;
  readonly tipoHora: string;
  /** `YYYY-MM-DD`. */
  readonly fecha: string;
  readonly funcional: string;
  readonly gestion: string;
  readonly modulo: string;
  readonly tecnologia: string;
  readonly tipoActividad: string;
  readonly proyecto: string;
  /** `HH:mm` o vacío. */
  readonly horaInicio: string;
  readonly horaFin: string;
}

export type ConsolidatedPreset = 'day' | '1m' | '3m' | '6m' | 'custom';

export const DEFAULT_CONSOLIDATED_PRESET: ConsolidatedPreset = '1m';

export const CONSOLIDATED_PRESETS: readonly { value: ConsolidatedPreset; label: string }[] = [
  { value: 'day', label: '1 día' },
  { value: '1m', label: '1 mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: 'custom', label: 'Personalizado' },
];

const PRESET_MONTHS = { '1m': 1, '3m': 3, '6m': 6 } as const;

/** Rango que termina hoy (`today` en `YYYY-MM-DD`): `Nm` empieza el día siguiente al de hace N meses, como Angular. */
export function consolidatedPresetRange(preset: Exclude<ConsolidatedPreset, 'custom'>, today: string) {
  const end = parseDateValue(today) ?? new Date();
  const start = preset === 'day' ? end : addDays(subMonths(end, PRESET_MONTHS[preset]), 1);
  return { from: toDateValue(start), to: toDateValue(end) };
}

export const HOUR_BILLING_OPTIONS: readonly { value: HourBillingFilter; label: string }[] = [
  { value: 'all', label: 'Todos los tipos de hora' },
  { value: 'billable', label: 'Facturables' },
  { value: 'factory', label: 'Fábrica' },
  { value: 'non_billable', label: 'No facturables' },
];

export interface ConsolidatedFilter {
  readonly consultant: string;
  readonly client: string;
  readonly day: string;
  readonly hourType: HourBillingFilter;
  readonly q: string;
}

const SEARCH_FIELDS = ['identificador', 'solicitud', 'gestion', 'descripcion', 'funcional', 'modulo', 'tecnologia'] as const;

/** Filas que cumplen los filtros, de la más reciente a la más antigua. */
export function filterConsolidated(
  rows: readonly ConsolidatedRow[],
  filter: ConsolidatedFilter,
  matchesHourType: (tipoHora: string, filter: HourBillingFilter) => boolean,
): ConsolidatedRow[] {
  const search = normalizeText(filter.q);
  return rows
    .filter(
      (row) =>
        (!filter.consultant || row.consultor === filter.consultant) &&
        (!filter.client || row.cliente === filter.client) &&
        (!filter.day || row.fecha === filter.day) &&
        matchesHourType(row.tipoHora, filter.hourType) &&
        (!search || SEARCH_FIELDS.some((field) => normalizeText(row[field]).includes(search))),
    )
    .sort((a, b) => `${b.fecha} ${b.horaInicio}`.localeCompare(`${a.fecha} ${a.horaInicio}`));
}

export interface DailySummaryRow {
  readonly fecha: string;
  readonly consultor: string;
  /** Clientes atendidos ese día, separados por " · ". */
  readonly clientes: string;
  readonly horas: number;
  readonly registros: number;
  readonly solicitudes: number;
}

/** Una fila por día y consultor (los nombres ya vienen unificados al leer el Excel). */
export function summarizeDaily(rows: readonly ConsolidatedRow[]): DailySummaryRow[] {
  const groups = new Map<string, { row: ConsolidatedRow; clientes: Set<string>; horas: number; registros: number; solicitudes: Set<string> }>();
  for (const row of rows) {
    const key = `${row.fecha}|${row.consultor}`;
    const group = groups.get(key) ?? { row, clientes: new Set(), horas: 0, registros: 0, solicitudes: new Set() };
    group.horas += row.horas;
    group.registros += 1;
    group.clientes.add(row.cliente);
    if (row.solicitud || row.gestion) group.solicitudes.add(row.solicitud || row.gestion);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      fecha: group.row.fecha,
      consultor: group.row.consultor,
      clientes: [...group.clientes].sort((a, b) => a.localeCompare(b, 'es')).join(' · '),
      horas: group.horas,
      registros: group.registros,
      solicitudes: group.solicitudes.size,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horas - a.horas);
}

export function summarizeTotals(rows: readonly ConsolidatedRow[]) {
  return {
    hours: rows.reduce((sum, row) => sum + row.horas, 0),
    days: new Set(rows.map((row) => row.fecha)).size,
    clients: new Set(rows.map((row) => row.cliente)).size,
    records: rows.length,
  };
}

export const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
