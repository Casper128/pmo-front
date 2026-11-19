import { useEffect, useState } from 'react';
import { colombiaToday } from '@presentation/shared/format';

/**
 * Hoy en Colombia (`YYYY-MM-DD`), recalculado al volver el foco o la visibilidad a la pestaña para que una
 * sesión abierta de un día para otro no quede con la fecha desfasada.
 */
export function useColombiaToday(): string {
  const [today, setToday] = useState(colombiaToday);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setToday(colombiaToday());
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}
