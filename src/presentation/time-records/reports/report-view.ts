import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';

/** Clave de los reportes cuyo día no se puede determinar: quedan fuera del libro mayor. */
export const NO_DAY_KEY = 'sin-fecha';

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

const isRealDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** `YYYY-MM-DD` de un ISO (`2026-09-09T19:30:00.000Z`) o de la etiqueta `Wed Sep 09 2026 12:00:00 GMT-0500 ...`. */
function dayFromText(value: unknown): string {
  const text = String(value ?? '');
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  const textual = text.match(
    /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/i,
  );
  const parts = iso
    ? [iso[1], iso[2], iso[3]]
    : textual
      ? [textual[3], MONTHS[textual[1].toLowerCase()] ?? '', textual[2].padStart(2, '0')]
      : null;
  if (!parts || !isRealDate(Number(parts[0]), Number(parts[1]), Number(parts[2]))) return '';
  return parts.join('-');
}

/**
 * Única forma de obtener el día (`YYYY-MM-DD`) de un reporte. `HoraInicio` guarda la hora de pared con una
 * `Z` engañosa, por eso es la primera fuente: nunca se convierte de zona. Si falta, se usa `fechaInicio`
 * (ISO o etiqueta de Colombia). `NO_DAY_KEY` si ninguna sirve.
 */
export function reportDayKey(report: ManagementReport): string {
  return dayFromText(report.HoraInicio) || dayFromText(report.fechaInicio) || NO_DAY_KEY;
}

/** Minutos desde medianoche de una hora `T19:30` o `19:30`; `null` si no hay hora válida. */
function minutesFromText(value: unknown): number | null {
  const match = String(value ?? '').match(/T(\d{2}):(\d{2})/) ?? String(value ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

/** `HH:mm` de `HoraInicio`/`HoraFin` (hora de pared, sin convertir zona); `''` si falta o no es válida. */
export function reportTime(value: unknown): string {
  const minutes = minutesFromText(value);
  return minutes === null ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export interface TimeInterval {
  readonly startMin: number;
  readonly endMin: number;
}

/** `true` si los intervalos se cruzan (que uno termine cuando el otro empieza no es cruce). */
export const intervalsOverlap = (a: TimeInterval, b: TimeInterval): boolean =>
  a.startMin < b.endMin && b.startMin < a.endMin;

export interface ReportView {
  readonly id: string;
  readonly dayKey: string;
  /** Horario del reporte; `null` si falta o no es válido (fin no posterior al inicio). */
  readonly interval: TimeInterval | null;
  /** Horas que cuentan para la jornada: 0 en Fábrica. */
  readonly computableHours: number;
}

/** Predicado del dominio (`TimeRecordDomainService.isCountableHour`): Fábrica no es computable. */
export type IsCountable = (tipoHora: string) => boolean;

export function toReportView(report: ManagementReport, isCountable: IsCountable): ReportView {
  const startMin = minutesFromText(report.HoraInicio);
  const endMin = minutesFromText(report.HoraFin);
  const hours = Number(report.tiempoRealHoras || 0);
  return {
    id: report.identificador ?? '',
    dayKey: reportDayKey(report),
    interval: startMin !== null && endMin !== null && endMin > startMin ? { startMin, endMin } : null,
    computableHours: isCountable(report.tipoHora || 'Laboral') && Number.isFinite(hours) ? hours : 0,
  };
}

export interface DayLedgerEntry {
  /** Horas computables ya enviadas ese día. */
  readonly sentHours: number;
  /** Horas computables de los borradores de ese día. */
  readonly draftHours: number;
  /** Horarios de los reportes ya enviados. */
  readonly sentIntervals: readonly TimeInterval[];
}

export type DayLedger = ReadonlyMap<string, DayLedgerEntry>;

/** Horas por día de los reportes enviados y de los borradores; Fábrica queda fuera de lo computable. */
export function buildDayLedger(
  sent: readonly ReportView[],
  drafts: readonly TimeRecord[],
  isCountable: IsCountable,
): DayLedger {
  const entries = new Map<string, { sentHours: number; draftHours: number; sentIntervals: TimeInterval[] }>();
  const entry = (day: string) => {
    const found = entries.get(day) ?? { sentHours: 0, draftHours: 0, sentIntervals: [] };
    entries.set(day, found);
    return found;
  };
  for (const view of sent) {
    if (view.dayKey === NO_DAY_KEY) continue;
    const item = entry(view.dayKey);
    item.sentHours += view.computableHours;
    if (view.interval) item.sentIntervals.push(view.interval);
  }
  for (const draft of drafts) {
    const hours = Number(draft.horas || 0);
    if (!draft.fecha || !isCountable(draft.tipoHora) || !Number.isFinite(hours)) continue;
    entry(draft.fecha).draftHours += hours;
  }
  return entries;
}
