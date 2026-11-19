import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { HourBillingFilter } from '@domain/time-records/services/time-record-domain.service';
import { parseDateValue } from '@presentation/shared/format';
import { useColombiaToday } from '@presentation/shared/hooks/use-colombia-today';
import { useDebouncedValue } from '@presentation/shared/hooks/use-debounced-value';
import {
  CONSOLIDATED_PRESETS,
  DEFAULT_CONSOLIDATED_PRESET,
  HOUR_BILLING_OPTIONS,
  consolidatedPresetRange,
  type ConsolidatedFilter,
  type ConsolidatedPreset,
} from './consolidated-report';

const PARAM = {
  preset: 'preset',
  from: 'desde',
  to: 'hasta',
  client: 'cliente',
  consultant: 'consultor',
  resultClient: 'clienteResultado',
  day: 'dia',
  hourType: 'tipoHora',
  q: 'q',
} as const;
type ParamKey = keyof typeof PARAM;
const RESULT_KEYS: readonly ParamKey[] = ['consultant', 'resultClient', 'day', 'hourType', 'q'];

export const SEARCH_DEBOUNCE_MS = 250;

const isPreset = (value: string | null): value is ConsolidatedPreset => CONSOLIDATED_PRESETS.some((preset) => preset.value === value);
const isHourType = (value: string | null): value is HourBillingFilter => HOUR_BILLING_OPTIONS.some((option) => option.value === value);
const validDate = (value: string | null) => (parseDateValue(value) ? (value as string) : null);

/**
 * Filtros del Consolidado en la URL (vista compartible). Consulta al servidor: `preset`, `desde`/`hasta` (solo en
 * Personalizado) y `cliente`. Filtros del resultado: `consultor`, `clienteResultado`, `dia`, `tipoHora` y `q`
 * (con debounce). Sin parámetros, el rango es el último mes hasta hoy.
 */
export function useConsolidatedFilters() {
  const [params, setParams] = useSearchParams();
  const today = useColombiaToday();

  const presetParam = params.get(PARAM.preset);
  const preset = isPreset(presetParam) ? presetParam : DEFAULT_CONSOLIDATED_PRESET;
  const defaultRange = consolidatedPresetRange('1m', today);
  const range =
    preset === 'custom'
      ? { from: validDate(params.get(PARAM.from)) ?? defaultRange.from, to: validDate(params.get(PARAM.to)) ?? defaultRange.to }
      : consolidatedPresetRange(preset, today);
  const client = params.get(PARAM.client) ?? '';
  const hourParam = params.get(PARAM.hourType);
  const q = params.get(PARAM.q) ?? '';
  const result: ConsolidatedFilter = {
    consultant: params.get(PARAM.consultant) ?? '',
    client: params.get(PARAM.resultClient) ?? '',
    day: params.get(PARAM.day) ?? '',
    hourType: isHourType(hourParam) ? hourParam : 'all',
    q,
  };
  const dateError = range.from > range.to ? 'La fecha inicial no puede ser posterior a la fecha final.' : '';

  const update = useCallback(
    (patch: Partial<Record<ParamKey, string | null>>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(PARAM[key as ParamKey], value);
            else next.delete(PARAM[key as ParamKey]);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const [searchText, setSearchText] = useState(q);
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (debouncedSearch !== q) update({ q: debouncedSearch });
    // Solo reacciona a lo tecleado; `q` cambia por esta misma escritura o por "Limpiar filtros".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const clearResult = () => {
    setSearchText('');
    update(Object.fromEntries(RESULT_KEYS.map((key) => [key, null])));
  };

  return {
    preset,
    from: range.from,
    to: range.to,
    client,
    dateError,
    result,
    /** Texto del buscador (inmediato); el filtro usa `result.q`, que llega con debounce. */
    searchText,
    setSearchText,
    setPreset: (value: ConsolidatedPreset) =>
      update(
        value === 'custom'
          ? { preset: value, from: range.from, to: range.to }
          : { preset: value === DEFAULT_CONSOLIDATED_PRESET ? null : value, from: null, to: null },
      ),
    setFrom: (from: string) => update({ preset: 'custom', from, to: range.to }),
    setTo: (to: string) => update({ preset: 'custom', from: range.from, to }),
    setClient: (value: string) => update({ client: value }),
    setResult: (key: 'consultant' | 'resultClient' | 'day' | 'hourType', value: string) =>
      update({ [key]: key === 'hourType' && value === 'all' ? null : value }),
    clearResult,
    /** Vuelve al último mes sin cliente ni filtros del resultado. */
    clearAll: () => {
      setSearchText('');
      update({ preset: null, from: null, to: null, client: null, ...Object.fromEntries(RESULT_KEYS.map((key) => [key, null])) });
    },
  };
}
