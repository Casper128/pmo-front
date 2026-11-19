import type {
  AdvancedTemplateFieldKey,
  AdvancedTemplateValues,
} from '@domain/time-records/models/management-template.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';

/**
 * Horas estimadas de la gestión: dato propio de la plantilla (viaja en `values`, sin cambio de backend). No es un
 * campo avanzado del registro: no se aplica al envío ni cuenta como obligatorio.
 */
export const ESTIMATED_HOURS_KEY = 'horasEstimadas';

/** Lee las horas estimadas de la plantilla; `null` si falta o no es un número ≥ 0. */
export function estimatedHoursOf(values: Readonly<Record<string, unknown>>): number | null {
  const raw = String(values[ESTIMATED_HOURS_KEY] ?? '').trim().replace(',', '.');
  if (!raw) return null;
  const hours = Number(raw);
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Aplica los valores de la plantilla sobre el registro. Ignora `tipoHora` y los valores vacíos, y conserva
 * `funcional` y `ricef` si el registro ya los trae. Fuente única para el envío y la vista previa del diálogo.
 */
export function applyTemplateValues(
  record: TimeRecord,
  values: AdvancedTemplateValues,
): TimeRecord & AdvancedTemplateValues {
  const copy: TimeRecord & AdvancedTemplateValues = { ...record };
  Object.entries(values).forEach(([key, value]) => {
    if (key === 'tipoHora' || key === ESTIMATED_HOURS_KEY || isBlank(value)) return;
    if ((key === 'funcional' || key === 'ricef') && !isBlank(copy[key])) return;
    copy[key as AdvancedTemplateFieldKey] = String(value);
  });
  return copy;
}
