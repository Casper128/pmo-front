import { useCallback, useSyncExternalStore } from 'react';

/** Se cumple la media query (reactivo). En servidor/sin `matchMedia` devuelve `false`. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);
      return () => list.removeEventListener('change', listener);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
