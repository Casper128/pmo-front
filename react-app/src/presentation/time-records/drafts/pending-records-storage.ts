import { useCallback, useState } from 'react';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';

/** Misma clave y formato (JSON de `TimeRecord[]`) que la app Angular. */
export const PENDING_RECORDS_STORAGE_KEY = 'pmo_pending_time_records';

/** `restorePendingRecords` de Angular: lista no vacía o `[]`; si el JSON está dañado borra la clave. */
export function readPendingRecords(): TimeRecord[] {
  try {
    const stored = localStorage.getItem(PENDING_RECORDS_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TimeRecord => typeof item === 'object' && item !== null);
  } catch {
    localStorage.removeItem(PENDING_RECORDS_STORAGE_KEY);
    return [];
  }
}

/** `persistPendingRecords` de Angular: sin registros borra la clave. */
export function writePendingRecords(records: readonly TimeRecord[]): void {
  if (!records.length) {
    localStorage.removeItem(PENDING_RECORDS_STORAGE_KEY);
    return;
  }
  localStorage.setItem(PENDING_RECORDS_STORAGE_KEY, JSON.stringify(records));
}

/**
 * Persistencia de borradores en `pmo_pending_time_records`. `restored` se lee una sola vez al montar
 * (inicializador perezoso: sin efectos, así StrictMode no restaura dos veces); `persist` se llama en cada
 * cambio y tras cada confirmación del envío (F8).
 */
export function usePendingRecordsStorage() {
  const [restored] = useState(readPendingRecords);
  const persist = useCallback((records: readonly TimeRecord[]) => writePendingRecords(records), []);
  return { restored, persist };
}
