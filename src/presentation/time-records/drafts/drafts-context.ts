import { createContext, useContext } from 'react';
import type { DayGroup, TimeRecord } from '@domain/time-records/models/time-record.model';
import type { SendPhase } from './send-phase';
import type { SendAllOutcome, SendProgress } from './use-send-all-records';

export type SaveEditResult =
  | { readonly status: 'saved' }
  | { readonly status: 'invalid'; readonly errors: readonly string[] }
  | { readonly status: 'locked' };

/** Estado y mutadores de los borradores. Todos los mutadores son no-op mientras `sendLocked`. */
export interface DraftsContextValue {
  /** Borradores ordenados por fecha y hora; el `index` de cada mutador es la posición en esta lista. */
  readonly records: readonly TimeRecord[];
  readonly groups: DayGroup[];
  /** Horas computables de todos los borradores (las de Fábrica no cuentan). */
  readonly totalGeneral: number;
  readonly sendPhase: SendPhase;
  /** Hay un envío o una confirmación pendiente: los borradores no se pueden modificar. */
  readonly sendLocked: boolean;
  /** Validando lo que se va a enviar (consulta de plantillas y de lo ya enviado). */
  readonly sendChecking: boolean;
  readonly sendProgress: SendProgress;
  /** Valida y envía todos los borradores. Un envío en vuelo, o uno validándose, ignora la llamada. */
  readonly sendAll: (options?: { confirmExcess?: boolean }) => Promise<SendAllOutcome>;
  /** Reintenta guardar el historial del envío (fase `log-error`). */
  readonly retrySendLogs: () => void;
  /** Cierra el diálogo de resultados (`continueAfterSend`). */
  readonly continueAfterSend: () => void;
  /** Agrega registros parseados (`onDraftRecordsChange`). `false` si el envío bloquea los cambios. */
  readonly addRecords: (parsed: readonly TimeRecord[]) => boolean;
  /** Cambio en la vista previa (`onPreviewRecordChange`): recalcula horas. Devuelve el registro nuevo. */
  readonly updateRecord: (index: number, change: (current: TimeRecord) => TimeRecord) => TimeRecord | null;
  /** Guarda una edición completa (`onSaveEdit`): valida con el dominio antes de guardar. */
  readonly saveEdit: (index: number, edited: TimeRecord) => SaveEditResult;
  /** Elimina un borrador; devuelve cuántos quedan o `null` si no se pudo. */
  readonly deleteRecord: (index: number) => number | null;
  /** Duplica un borrador; devuelve la copia y su índice, o `null` si no se pudo. */
  readonly duplicateRecord: (index: number) => { readonly index: number; readonly record: TimeRecord } | null;
  /** Cancela la importación: vacía los borradores (`onCancelImport`). */
  readonly clearRecords: () => void;
}

export const DraftsContext = createContext<DraftsContextValue | null>(null);

/** Borradores del shell. Falla si se usa fuera de `DraftsProvider`. */
export function useDrafts(): DraftsContextValue {
  const value = useContext(DraftsContext);
  if (!value) throw new Error('useDrafts debe usarse dentro de <DraftsProvider>.');
  return value;
}
