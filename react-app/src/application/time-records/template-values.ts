import type {
  AdvancedTemplateFieldKey,
  AdvancedTemplateValues,
} from '@domain/time-records/models/management-template.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';

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
    if (key === 'tipoHora' || isBlank(value)) return;
    if ((key === 'funcional' || key === 'ricef') && !isBlank(copy[key])) return;
    copy[key as AdvancedTemplateFieldKey] = String(value);
  });
  return copy;
}
