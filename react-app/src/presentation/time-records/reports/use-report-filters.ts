import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebouncedValue } from '@presentation/shared/hooks/use-debounced-value';
import { colombiaToday, parseDateValue } from '@presentation/shared/format';
import { DEFAULT_REPORT_PRESET, REPORT_PRESETS, reportPresetRange, type ReportPreset } from './report-list';

const PARAM = { preset: 'preset', from: 'from', to: 'to', q: 'q', client: 'cliente', report: 'report', mode: 'mode' } as const;
export type ReportMode = 'view' | 'edit';
export const SEARCH_DEBOUNCE_MS = 250;

const isPreset = (value: string | null): value is ReportPreset => REPORT_PRESETS.some((preset) => preset.value === value);
const validDate = (value: string | null) => (parseDateValue(value) ? (value as string) : null);

/**
 * Filtros de Reportes en la URL (vista compartible): `preset`, `from`/`to` (solo en Personalizado), `q`, `cliente` y el
 * reporte abierto (`report` + `mode`). Sin parámetros, el rango es el mes actual. La búsqueda se escribe con
 * debounce; el resto de cambios usa `replace` para no llenar el historial.
 */
export function useReportFilters() {
  const [params, setParams] = useSearchParams();
  const today = colombiaToday();

  const presetParam = params.get(PARAM.preset);
  const preset = isPreset(presetParam) ? presetParam : DEFAULT_REPORT_PRESET;
  const monthRange = reportPresetRange('month', today);
  const range =
    preset === 'custom'
      ? { from: validDate(params.get(PARAM.from)) ?? monthRange.from, to: validDate(params.get(PARAM.to)) ?? monthRange.to }
      : reportPresetRange(preset, today);
  const q = params.get(PARAM.q) ?? '';
  const client = params.get(PARAM.client) ?? '';
  const reportId = params.get(PARAM.report) ?? '';
  const mode: ReportMode = params.get(PARAM.mode) === 'edit' ? 'edit' : 'view';
  const dateError = range.from > range.to ? 'La fecha inicial no puede ser posterior a la fecha final.' : '';

  const update = useCallback(
    (patch: Partial<Record<keyof typeof PARAM, string | null>>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(PARAM[key as keyof typeof PARAM], value);
            else next.delete(PARAM[key as keyof typeof PARAM]);
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

  return {
    today,
    preset,
    from: range.from,
    to: range.to,
    client,
    /** Texto del buscador (inmediato); el filtro usa `q`, que llega con debounce. */
    searchText,
    setSearchText,
    q,
    dateError,
    reportId,
    mode,
    setPreset: (value: ReportPreset) =>
      update(
        value === 'custom'
          ? { preset: value, from: range.from, to: range.to }
          : { preset: value === DEFAULT_REPORT_PRESET ? null : value, from: null, to: null },
      ),
    setFrom: (from: string) => update({ preset: 'custom', from, to: range.to }),
    setTo: (to: string) => update({ preset: 'custom', from: range.from, to }),
    setClient: (value: string) => update({ client: value || null }),
    openReport: (id: string, nextMode: ReportMode = 'view') => update({ report: id, mode: nextMode === 'edit' ? 'edit' : null }),
    closeReport: () => update({ report: null, mode: null }),
    clear: () => {
      setSearchText('');
      update({ preset: null, from: null, to: null, q: null, client: null });
    },
  };
}
