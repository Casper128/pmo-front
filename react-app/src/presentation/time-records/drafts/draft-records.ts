import type { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';

const FALLBACK_TIPO_HORA = 'Laboral';

/** `minutesOf` de Angular: minutos desde medianoche; 0 si la hora no es válida. */
export function minutesOf(value: string): number {
  const [hour, minute] = String(value || '')
    .split(':')
    .map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

/** `sortedRecords` de Angular: por fecha, hora de inicio y hora de fin (orden estable). */
export function sortRecords(records: readonly TimeRecord[]): TimeRecord[] {
  return [...records].sort((a, b) => {
    const dateComparison = String(a.fecha || '').localeCompare(String(b.fecha || ''));
    if (dateComparison !== 0) return dateComparison;
    const startComparison = minutesOf(a.horaIni) - minutesOf(b.horaIni);
    if (startComparison !== 0) return startComparison;
    return minutesOf(a.horaFin) - minutesOf(b.horaFin);
  });
}

/** `applyImportDefaults` de Angular: el tipo de hora vacío toma el predeterminado configurado. */
export function applyImportDefaults(record: TimeRecord, defaultTipoHora: string): TimeRecord {
  return { ...record, tipoHora: record.tipoHora || defaultTipoHora || FALLBACK_TIPO_HORA };
}

/** `markDuplicatedRecord` de Angular. */
export function markDuplicatedRecord(record: TimeRecord): TimeRecord {
  const gestionId = record.gestionId || record.solicitud;
  return { ...record, duplicatedFromGestionId: gestionId || record.duplicatedFromGestionId };
}

/** `sameDraftRecord` de Angular. */
export function sameDraftRecord(left: TimeRecord, right: TimeRecord): boolean {
  return (
    left.fecha === right.fecha &&
    left.horaIni === right.horaIni &&
    left.horaFin === right.horaFin &&
    left.desc === right.desc &&
    left.cliente === right.cliente &&
    left.solicitud === right.solicitud &&
    left.gestionId === right.gestionId &&
    left.tipoHora === right.tipoHora
  );
}

/** `findLastMatchingRecordIndex` de Angular. */
export function findLastMatchingRecordIndex(records: readonly TimeRecord[], target: TimeRecord): number {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (sameDraftRecord(records[index], target)) return index;
  }
  return -1;
}

/** Faltantes e inválidos del dominio (lo que Angular llama `getErrors`). */
export function recordErrors(domain: TimeRecordDomainService, record: TimeRecord): string[] {
  return [...domain.getMissingFields(record), ...domain.getInvalidFields(record)];
}

/** Errores al guardar una edición: los del dominio más el tope diario de un registro computable. */
export function recordSaveErrors(domain: TimeRecordDomainService, record: TimeRecord): string[] {
  const errors = recordErrors(domain, record);
  if (domain.isCountableHour(record.tipoHora) && Number(record.horas || 0) > domain.getMaxDailyLaborHours()) {
    errors.push(`Un registro computable no puede superar ${domain.getMaxDailyLaborHours()} horas`);
  }
  return errors;
}

/** Cambio de cliente de la vista previa: reinicia proyecto y gestión (y los campos heredados de un duplicado). */
export function applyClienteChange(record: TimeRecord, cliente: string): TimeRecord {
  return {
    ...record,
    cliente,
    proyecto: '',
    solicitud: '',
    gestionId: '',
    funcional: record.duplicatedFromGestionId ? '' : record.funcional,
    ricef: record.duplicatedFromGestionId ? '' : record.ricef,
    duplicatedFromGestionId: record.duplicatedFromGestionId ? undefined : record.duplicatedFromGestionId,
  };
}

/** Cambio de gestión de la vista previa (`onGestionChange` de `RecordsPreviewComponent`). */
export function applyGestionChange(
  record: TimeRecord,
  option: ManagementDemandOption | undefined,
  gestionId: string,
): TimeRecord {
  const changedDuplicatedGestion =
    !!record.duplicatedFromGestionId && record.duplicatedFromGestionId !== gestionId;
  return {
    ...record,
    gestionId,
    solicitud: option?.requestValue || option?.name || gestionId,
    proyecto: option?.project || record.proyecto,
    funcional: changedDuplicatedGestion ? '' : record.funcional,
    ricef: changedDuplicatedGestion ? '' : record.ricef,
    duplicatedFromGestionId: changedDuplicatedGestion ? undefined : record.duplicatedFromGestionId,
  };
}

/** Elección automática de gestión: la recordada para el cliente, la actual del registro o la primera. */
export function preferredGestion(
  options: readonly ManagementDemandOption[],
  remembered: string,
  currentGestionId: string,
): ManagementDemandOption | undefined {
  return (
    options.find((item) => item.id === remembered) ||
    options.find((item) => item.id === currentGestionId) ||
    options[0]
  );
}
