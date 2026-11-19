import { useCallback, useSyncExternalStore } from 'react';
import type { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { useContainer } from '@presentation/providers/container-context';

/**
 * Lee un valor de los parámetros globales y se re-renderiza cuando cambia (también cuando cambia el
 * usuario, del que depende `canManage`). `select` debe devolver un valor estable: un primitivo o una
 * referencia del estado (`p.workSettings()`), nunca un objeto o array nuevo en cada llamada.
 */
export function useAppParameters<T>(select: (parameters: AppParametersFacade) => T): T {
  const { parameters } = useContainer();
  const subscribe = useCallback(
    (listener: () => void) => parameters.subscribe(listener),
    [parameters],
  );
  return useSyncExternalStore(subscribe, () => select(parameters));
}
