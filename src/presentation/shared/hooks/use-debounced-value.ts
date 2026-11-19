import { useEffect, useState } from 'react';

/** Valor que se actualiza `delay` ms después del último cambio (búsquedas que filtran listas grandes). */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
