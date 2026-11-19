import { parseDateValue } from '@presentation/shared/format';

/** Límites por defecto de `ui-date-input`. */
export const DEFAULT_MIN_DATE = '2000-01-01';
export const DEFAULT_MAX_DATE = '2100-12-31';

/**
 * Restricciones de react-day-picker para `[min, max]` (`YYYY-MM-DD`). `isAllowed` compara strings como
 * `UiDateInputComponent.isAllowed`.
 */
export function dateBounds(min: string, max: string) {
  const minDate = parseDateValue(min);
  const maxDate = parseDateValue(max);
  return {
    disabled: [...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])],
    startMonth: minDate,
    endMonth: maxDate,
    isAllowed: (value: string) => (!min || value >= min) && (!max || value <= max),
  };
}
