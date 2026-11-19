import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { TimeDashboardFilter, TimeDashboardPeriodPreset } from '@domain/time-records/models/time-dashboard.model';
import type { TimeDashboardCalculator } from '@domain/time-records/services/time-dashboard.calculator';
import { todayDateValue } from '@presentation/shared/format';

export const DEFAULT_PRESET: TimeDashboardPeriodPreset = '3m';
export const PERIOD_PRESETS: readonly { value: TimeDashboardPeriodPreset; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
];

/** Nombres de los search params; sin parámetro, el periodo es el del preset por defecto. */
const PARAM = { from: 'desde', to: 'hasta', client: 'cliente', hourType: 'tipoHora' } as const;

/**
 * Filtros del dashboard en la URL (vista compartible). El preset activo no se guarda: se deduce de si el
 * rango coincide con `presetRange` de hoy, así nunca queda desincronizado de las fechas.
 */
export function useDashboardFilters(calculator: TimeDashboardCalculator) {
  const [params, setParams] = useSearchParams();
  const today = todayDateValue();
  const defaults = useMemo(() => calculator.presetRange(DEFAULT_PRESET, today), [calculator, today]);

  const filter: TimeDashboardFilter = {
    from: params.get(PARAM.from) ?? defaults.from,
    to: params.get(PARAM.to) ?? defaults.to,
    client: params.get(PARAM.client) ?? '',
    hourType: params.get(PARAM.hourType) ?? '',
  };
  const activePreset =
    PERIOD_PRESETS.find((preset) => {
      const range = calculator.presetRange(preset.value, today);
      return range.from === filter.from && range.to === filter.to;
    })?.value ?? '';
  const dateError = !filter.from || !filter.to
    ? 'Selecciona la fecha inicial y la fecha final.'
    : filter.from > filter.to
      ? 'La fecha inicial no puede ser posterior a la fecha final.'
      : '';

  const update = useCallback(
    (patch: Partial<Record<keyof typeof PARAM, string | null>>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null) next.delete(PARAM[key as keyof typeof PARAM]);
            else next.set(PARAM[key as keyof typeof PARAM], value);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const applyPreset = (preset: TimeDashboardPeriodPreset) => {
    const range = calculator.presetRange(preset, today);
    update({ from: range.from, to: range.to });
  };

  return {
    filter,
    activePreset,
    dateError,
    today,
    setFrom: (from: string) => update({ from }),
    setTo: (to: string) => update({ to }),
    setClient: (client: string) => update({ client: client || null }),
    setHourType: (hourType: string) => update({ hourType: hourType || null }),
    applyPreset,
    reset: () => update({ from: null, to: null, client: null, hourType: null }),
  };
}
