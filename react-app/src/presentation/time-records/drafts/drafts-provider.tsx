import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import { useContainer } from '@presentation/providers/container-context';
import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';
import { DraftsContext, type DraftsContextValue } from './drafts-context';
import { applyImportDefaults, findLastMatchingRecordIndex, markDuplicatedRecord, recordSaveErrors, sortRecords } from './draft-records';
import { usePendingRecordsStorage } from './pending-records-storage';
import type { SendPhase } from './send-phase';
import { useSendAllRecords } from './use-send-all-records';

export interface DraftsProviderProps {
  readonly children: ReactNode;
  /** Fase inicial del envío. Solo la usan las pruebas para montar los borradores ya bloqueados. */
  readonly initialSendPhase?: SendPhase;
}

/**
 * Borradores y estado de envío a nivel de shell (plan §1.6): por encima de las rutas, así el bloqueo y la
 * lista sobreviven a la navegación. Persiste en `pmo_pending_time_records` y restaura al montar.
 *
 * `recordsRef` se actualiza de forma síncrona en cada cambio (`commit`): los mutadores leen siempre el estado
 * más reciente aunque se llamen varias veces antes del siguiente render (doble clic, selects automáticos).
 */
export function DraftsProvider({ children, initialSendPhase = 'idle' }: DraftsProviderProps) {
  const { domainService: domain, parameters } = useContainer();
  const workSettings = useAppParameters((p) => p.workSettings());
  const { restored, persist } = usePendingRecordsStorage();
  const [records, setRecords] = useState<TimeRecord[]>(() => sortRecords(restored));
  const recordsRef = useRef<TimeRecord[]>(records);

  // `restored` ya está ordenado en el estado inicial; el aviso se muestra una sola vez (StrictMode ejecuta
  // los efectos dos veces).
  const restoreNotified = useRef(false);
  useEffect(() => {
    if (restoreNotified.current || !restored.length) return;
    restoreNotified.current = true;
    toast.success(`Se restauraron ${restored.length} registros pendientes.`);
  }, [restored]);

  const commit = useCallback(
    (next: readonly TimeRecord[]) => {
      const sorted = sortRecords(next);
      recordsRef.current = sorted;
      setRecords(sorted);
      persist(sorted);
      return sorted;
    },
    [persist],
  );

  const getRecords = useCallback(() => recordsRef.current, []);
  const removeSent = useCallback(
    (sent: ReadonlySet<TimeRecord>) => commit(recordsRef.current.filter((record) => !sent.has(record))),
    [commit],
  );
  const send = useSendAllRecords({ initialPhase: initialSendPhase, getRecords, removeSent });
  const { isLocked, reset: resetSendTracking } = send;

  const defaultTipoHora = useCallback(() => parameters.defaultFor('tipoHora'), [parameters]);

  const addRecords = useCallback(
    (parsed: readonly TimeRecord[]) => {
      if (isLocked()) return false;
      const prepared = [...recordsRef.current, ...parsed].map((record) =>
        applyImportDefaults(record, defaultTipoHora()),
      );
      commit(prepared);
      resetSendTracking();
      return true;
    },
    [commit, defaultTipoHora, isLocked, resetSendTracking],
  );

  const updateRecord = useCallback(
    (index: number, change: (current: TimeRecord) => TimeRecord) => {
      if (isLocked()) return null;
      const current = recordsRef.current[index];
      if (!current) return null;
      const changed = change(current);
      const updated = { ...changed, horas: domain.calcHoras(changed.horaIni, changed.horaFin) };
      commit(recordsRef.current.map((record, position) => (position === index ? updated : record)));
      resetSendTracking();
      return updated;
    },
    [commit, domain, isLocked, resetSendTracking],
  );

  const saveEdit = useCallback<DraftsContextValue['saveEdit']>(
    (index, edited) => {
      if (isLocked()) return { status: 'locked' };
      if (!recordsRef.current[index]) return { status: 'invalid', errors: [] };
      const updated = { ...edited, horas: domain.calcHoras(edited.horaIni, edited.horaFin) };
      const errors = recordSaveErrors(domain, updated);
      if (errors.length > 0) return { status: 'invalid', errors };
      commit(recordsRef.current.map((record, position) => (position === index ? updated : record)));
      return { status: 'saved' };
    },
    [commit, domain, isLocked],
  );

  const deleteRecord = useCallback(
    (index: number) => {
      if (isLocked() || !recordsRef.current[index]) return null;
      return commit(recordsRef.current.filter((_, position) => position !== index)).length;
    },
    [commit, isLocked],
  );

  const duplicateRecord = useCallback(
    (index: number) => {
      const source = recordsRef.current[index];
      if (isLocked() || !source) return null;
      const copy = markDuplicatedRecord(source);
      const draft = applyImportDefaults(
        { ...copy, horas: domain.calcHoras(copy.horaIni, copy.horaFin) || copy.horas || '0' },
        defaultTipoHora(),
      );
      const next = commit([...recordsRef.current, draft]);
      resetSendTracking();
      const newIndex = findLastMatchingRecordIndex(next, draft);
      return newIndex >= 0 ? { index: newIndex, record: next[newIndex] } : null;
    },
    [commit, defaultTipoHora, domain, isLocked, resetSendTracking],
  );

  const clearRecords = useCallback(() => {
    if (isLocked()) return;
    commit([]);
    resetSendTracking();
  }, [commit, isLocked, resetSendTracking]);

  const groups = useMemo(
    () => {
      // `workSettings` cambia cuando terminan de cargar los parámetros: las alertas por día dependen de la
      // jornada configurada y deben recalcularse.
      void workSettings;
      return domain.groupByDate(records);
    },
    [domain, records, workSettings],
  );
  const totalGeneral = useMemo(
    () =>
      records.reduce(
        (sum, record) => (domain.isCountableHour(record.tipoHora) ? sum + parseFloat(record.horas || '0') : sum),
        0,
      ),
    [domain, records],
  );

  const value = useMemo<DraftsContextValue>(
    () => ({
      records,
      groups,
      totalGeneral,
      sendPhase: send.phase,
      sendLocked: send.locked,
      sendChecking: send.checking,
      sendProgress: send.progress,
      sendAll: send.sendAll,
      retrySendLogs: send.retrySendLogs,
      continueAfterSend: send.continueAfterSend,
      addRecords,
      updateRecord,
      saveEdit,
      deleteRecord,
      duplicateRecord,
      clearRecords,
    }),
    [records, groups, totalGeneral, send.phase, send.locked, send.checking, send.progress, send.sendAll, send.retrySendLogs, send.continueAfterSend, addRecords, updateRecord, saveEdit, deleteRecord, duplicateRecord, clearRecords],
  );

  return <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>;
}
