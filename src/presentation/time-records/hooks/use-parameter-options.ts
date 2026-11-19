import { useMemo } from 'react';
import type { AdvancedFieldKey } from '@domain/configuration/app-parameters.model';
import { useContainer } from '@presentation/providers/container-context';
import type { AppSelectOption } from '@presentation/shared/components/app-select';
import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';

/**
 * Opciones configurables de un parámetro (`optionsFor` de Angular) para `AppSelect`. `optionsFor` devuelve un
 * array nuevo en cada llamada, así que se memoiza sobre `fields()` (referencia estable del estado).
 */
export function useParameterOptions(key: AdvancedFieldKey): AppSelectOption[] {
  const { parameters } = useContainer();
  const fields = useAppParameters((p) => p.fields());
  return useMemo(
    () =>
      parameters
        .optionsFor(key)
        .map((option) => ({ value: option.value, label: option.label, disabled: !option.active })),
    // `fields` no se lee en el callback: `optionsFor` lo consulta por dentro y devuelve un array nuevo en cada
    // llamada (no sirve como selector de `useAppParameters`), así que `fields` es solo la señal de invalidación.
    // Evitar el disable exigiría que la fachada exponga las opciones con referencia estable (cambio de contrato).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parameters, key, fields],
  );
}
