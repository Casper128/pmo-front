import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import { colombiaDateLabel } from '@domain/time-records/services/colombia-date-label';
import type { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { markDuplicatedRecord, minutesOf } from '../drafts/draft-records';
import type { ReportRow } from './report-list';
import { NO_DAY_KEY, intervalsOverlap, type DayLedger, type ReportView, type TimeInterval } from './report-view';

const GESTION_ID_KEYS = ['gestionId', 'idGestion', 'idSolicitud', 'solicitudId', 'id_solicitud', 'id_gestion', 'solicitud', 'gestionDemanda'];
const NO_MANAGEMENT = 'Sin gestión';
const NO_CLIENT = 'Sin cliente';

/** Horas tecleadas: coma o punto decimal y hasta 2 decimales ("1,5"). `null` si no es un número válido (nunca 0 en silencio). */
export function parseHoursInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : null;
}

/** Horario como intervalo; `null` si falta o el fin no es posterior al inicio. */
export function intervalOf(start: string, end: string): TimeInterval | null {
  const startMin = minutesOf(start);
  const endMin = minutesOf(end);
  return start && end && endMin > startMin ? { startMin, endMin } : null;
}

export interface DraftTarget {
  readonly fecha: string;
  readonly horaIni: string;
  readonly horaFin: string;
}

/**
 * Borrador a partir de un reporte enviado (equivale a `managementReportToDraftRecord` de Angular). Sin
 * horario en el reporte, `horaIni`/`horaFin` quedan vacías: no se inventa una hora y Reportar la pide.
 */
export function reportToDraft(
  row: ReportRow,
  domain: TimeRecordDomainService,
  defaultTipoHora: string,
  target?: Partial<DraftTarget>,
): TimeRecord {
  const { report } = row;
  const horaIni = target?.horaIni ?? row.start;
  const horaFin = target?.horaFin ?? row.end;
  const idFromReport = GESTION_ID_KEYS.map((key) => String(report[key] ?? '').trim()).find(Boolean);
  const solicitud = row.managementName === NO_MANAGEMENT ? String(report.solicitud || '') : row.managementName;
  const sameTimes = horaIni === row.start && horaFin === row.end;
  return markDuplicatedRecord({
    fecha: target?.fecha ?? (row.view.dayKey === NO_DAY_KEY ? '' : row.view.dayKey),
    horaIni,
    horaFin,
    horas: domain.calcHoras(horaIni, horaFin) || (sameTimes ? String(report.tiempoRealHoras || '0') : '0'),
    desc: row.description,
    observacion: report.observacion || report.descripcionActividad || '',
    cliente: row.clientName === NO_CLIENT ? String(report.cliente || '') : row.clientName,
    proyecto: String(report.proyecto || ''),
    solicitud,
    gestionId: idFromReport || (row.managementName === NO_MANAGEMENT ? '' : row.managementName),
    tipoHora: report.tipoHora || defaultTipoHora || 'Laboral',
    funcional: report.funcional || '',
    ricef: report.objetoRicef || '',
  });
}

export interface ReportEditValues {
  readonly fecha: string;
  readonly horaIni: string;
  readonly horaFin: string;
  readonly tipoHora: string;
  /** Horas tecleadas; solo cuentan si el tipo de hora no es computable (Fábrica). */
  readonly horas: string;
  readonly descripcion: string;
}

/** Horas que se guardan: la duración calculada, o las tecleadas en Fábrica. `null` si las tecleadas no son válidas. */
export function effectiveHours(domain: TimeRecordDomainService, values: ReportEditValues): string | null {
  if (domain.isCountableHour(values.tipoHora)) return domain.calcHoras(values.horaIni, values.horaFin);
  const typed = parseHoursInput(values.horas);
  return typed === null ? null : String(typed);
}

/** Errores que bloquean guardar: las reglas de fecha, horario y duración del dominio (misma fuente que el envío). */
export function reportEditErrors(domain: TimeRecordDomainService, values: ReportEditValues): string[] {
  const hours = effectiveHours(domain, values);
  const errors = domain.getInvalidFields({
    fecha: values.fecha,
    horaIni: values.horaIni,
    horaFin: values.horaFin,
    horas: hours ?? '0',
    desc: values.descripcion,
    observacion: values.descripcion,
    cliente: '',
    proyecto: '',
    solicitud: '',
    gestionId: '',
    tipoHora: values.tipoHora,
  });
  const result = hours === null ? errors.filter((message) => !message.startsWith('Horas')) : errors;
  if (hours === null) result.push('Horas inválidas: usa hasta 2 decimales, por ejemplo 1,5');
  if (!values.descripcion.trim()) result.push('Descripción requerida');
  return result;
}

/** Cuerpo del PATCH de edición (`buildManagementEditBody` de Angular): hora de pared con la `Z` que espera el servidor. */
export function buildReportEditBody(values: ReportEditValues, hours: string): Record<string, unknown> {
  const description = values.descripcion.trim();
  return {
    HoraInicio: `${values.fecha}T${values.horaIni}:00.000Z`,
    HoraFin: `${values.fecha}T${values.horaFin}:00.000Z`,
    tiempoRealHoras: hours,
    fechaInicio: colombiaDateLabel(values.fecha),
    tipoHora: values.tipoHora || 'Laboral',
    descripcionActividad: description,
    observacion: description,
  };
}

export interface DayLoad {
  /** El horario cruza el de otro reporte enviado ese día. */
  readonly overlaps: boolean;
  /** Horas computables del día con el candidato: enviadas + borradores + candidato. */
  readonly totalHours: number;
}

/**
 * Carga de un día con un reporte candidato (nuevo o editado). Con `own` (el reporte que se edita) se descuentan
 * sus horas y su horario del libro mayor si el día no cambia.
 */
export function dayLoad(
  ledger: DayLedger | null,
  dayKey: string,
  candidate: { readonly interval: TimeInterval | null; readonly computableHours: number },
  own?: ReportView,
): DayLoad {
  const entry = ledger?.get(dayKey);
  const isOwnDay = own?.dayKey === dayKey;
  const intervals = [...(entry?.sentIntervals ?? [])];
  const ownIndex = isOwnDay && own.interval ? intervals.findIndex((item) => item.startMin === own.interval?.startMin && item.endMin === own.interval?.endMin) : -1;
  if (ownIndex >= 0) intervals.splice(ownIndex, 1);
  const baseHours = (entry?.sentHours ?? 0) + (entry?.draftHours ?? 0) - (isOwnDay ? own.computableHours : 0);
  return {
    overlaps: !!candidate.interval && intervals.some((item) => intervalsOverlap(item, candidate.interval as TimeInterval)),
    totalHours: Math.round((baseHours + candidate.computableHours) * 100) / 100,
  };
}
