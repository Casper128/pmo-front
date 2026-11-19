import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { SendRecordLog, SendResult } from '@application/time-records/use-cases/send-all-records.use-case';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import { useContainer } from '@presentation/providers/container-context';
import { useAuth } from '@presentation/shared/hooks/use-auth';
import { queryKeys } from '@presentation/shared/query-keys';
import { consultantIdOf, myReportsQueryOptions, ownReports } from '../reports/use-my-reports';
import { buildDayLedger, toReportView, type DayLedger } from '../reports/report-view';
import { buildManagementTemplateMap, type TemplateMap } from './template-rules';
import { isSendActive, isSendLocked, progressPercent, type SendPhase } from './send-phase';
import { validateBeforeSend, type SendCheck } from './send-validation';

/** Resultado de pedir un envío: o arrancó, o se ignoró, o una validación lo detuvo (la página la muestra). */
export type SendAllOutcome = { readonly status: 'started' } | { readonly status: 'ignored' } | Exclude<SendCheck, { status: 'ok' }>;

export interface SendProgress {
  readonly total: number;
  readonly processed: number;
  readonly percent: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly failureMessage: string;
  /** Resultado de cada registro del lote, disponible al completar el envío. */
  readonly results: readonly SendRecordLog[];
}

interface SendState {
  readonly phase: SendPhase;
  readonly total: number;
  readonly processed: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly failureMessage: string;
  readonly results: readonly SendRecordLog[];
}

const IDLE_STATE: SendState = {
  phase: 'idle',
  total: 0,
  processed: 0,
  successCount: 0,
  errorCount: 0,
  failureMessage: '',
  results: [],
};

/** `getErrorMessage` de Angular. */
function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return 'Intenta nuevamente.';
  const response = error as Record<string, unknown>;
  const nested = response['error'];
  if (nested && typeof nested === 'object') {
    const nestedMessage = (nested as Record<string, unknown>)['message'];
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage;
  }
  const message = response['message'];
  return typeof message === 'string' && message.trim() ? message : 'Intenta nuevamente.';
}

export interface UseSendAllRecordsOptions {
  readonly initialPhase: SendPhase;
  /** Borradores vigentes (lectura síncrona). */
  readonly getRecords: () => readonly TimeRecord[];
  /** Retira de borradores y de `pmo_pending_time_records` los registros confirmados (por referencia). */
  readonly removeSent: (sent: ReadonlySet<TimeRecord>) => void;
}

/**
 * Envío masivo (`onSendAll` y compañía de Angular). Vive en el `DraftsProvider` del shell para que el
 * bloqueo sobreviva a la navegación (plan §1.6). `inFlightRef` se fija de forma síncrona antes de cualquier
 * `await`, así un segundo clic (o StrictMode) no arranca otro envío; `runId` descarta progresos y resultados
 * de ejecuciones anteriores. No usa `AbortSignal`: ninguna acción cancela el envío.
 */
export function useSendAllRecords({ initialPhase, getRecords, removeSent }: UseSendAllRecordsOptions) {
  const { domainService: domain, templates, timeManagement, sendLogs, sendAllRecords } = useContainer();
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  const [state, setState] = useState<SendState>({ ...IDLE_STATE, phase: initialPhase });
  const [checking, setChecking] = useState(false);
  const phaseRef = useRef<SendPhase>(initialPhase);
  const inFlightRef = useRef(false);
  const runIdRef = useRef(0);
  const sentRef = useRef(new Set<TimeRecord>());
  const pendingResultRef = useRef<SendResult | null>(null);

  const update = useCallback((patch: Partial<SendState>) => {
    if (patch.phase) phaseRef.current = patch.phase;
    setState((previous) => ({ ...previous, ...patch }));
  }, []);

  /** Bloquea los mutadores de borradores: validando, enviando, confirmando o pendiente de confirmar el historial. */
  const isLocked = useCallback(() => inFlightRef.current || isSendLocked(phaseRef.current), []);

  /** `resetSendTracking` de Angular: nunca libera con un envío o una confirmación en curso. */
  const reset = useCallback(() => {
    if (inFlightRef.current || isSendActive(phaseRef.current)) return;
    sentRef.current = new Set();
    pendingResultRef.current = null;
    phaseRef.current = 'idle';
    setState(IDLE_STATE);
  }, []);

  /** `persistSendLogs`: se llama al terminar el envío y en cada reintento (misma ejecución). */
  const persistLogs = useCallback(
    async (result: SendResult, runId: number) => {
      update({ phase: 'saving-logs', failureMessage: '' });
      try {
        await sendLogs.createMany(
          result.logs.map((log) => ({
            itemIndex: log.index,
            successful: log.ok,
            reference: log.identificador,
            errorMessage: log.errorMessage,
          })),
        );
      } catch (error) {
        if (runId !== runIdRef.current) return;
        inFlightRef.current = false;
        update({ phase: 'log-error', failureMessage: errorMessageOf(error) });
        return;
      }
      if (runId !== runIdRef.current) return;
      inFlightRef.current = false;
      update({ phase: 'completed', successCount: result.enviados, errorCount: result.errores, results: result.logs });
      // El historial de Reportes cambió: se vuelve a consultar al abrirlo.
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
    [sendLogs, queryClient, update],
  );

  /** Horas ya enviadas por día; `null` si la consulta falla (solo avisa, no bloquea). */
  const loadLedger = useCallback(
    async (records: readonly TimeRecord[]): Promise<DayLedger | null> => {
      const user = auth.user();
      try {
        const rows = await queryClient.fetchQuery({
          ...myReportsQueryOptions(timeManagement, consultantIdOf(user)),
          staleTime: 0,
          retry: false,
        });
        const isCountable = (tipoHora: string) => domain.isCountableHour(tipoHora);
        return buildDayLedger(ownReports(rows, user).map((row) => toReportView(row, isCountable)), records, isCountable);
      } catch {
        return null;
      }
    },
    [auth, queryClient, timeManagement, domain],
  );

  const loadTemplates = useCallback(async (): Promise<TemplateMap> => {
    try {
      const list = await queryClient.ensureQueryData({ queryKey: queryKeys.templates.all, queryFn: () => templates.list() });
      return buildManagementTemplateMap(list);
    } catch {
      return buildManagementTemplateMap([]);
    }
  }, [queryClient, templates]);

  const sendAll = useCallback(
    async ({ confirmExcess = false }: { confirmExcess?: boolean } = {}): Promise<SendAllOutcome> => {
      if (inFlightRef.current || isSendLocked(phaseRef.current)) return { status: 'ignored' };
      inFlightRef.current = true;
      setChecking(true);

      let batch: TimeRecord[] = [];
      try {
        batch = [...getRecords()];
        const templateMap = batch.length ? await loadTemplates() : buildManagementTemplateMap([]);
        const ledger = batch.length ? await loadLedger(batch) : null;
        const check = validateBeforeSend({
          records: batch,
          domain,
          templates: templateMap,
          knownManagement: (id) => templates.knownManagement(id),
          ledger,
          confirmExcess,
        });
        if (check.status !== 'ok') {
          inFlightRef.current = false;
          return check;
        }
        if (!ledger) {
          toast.warning('No se pudo verificar lo ya enviado; se continúa sin esa comprobación.');
        }
      } catch (error) {
        inFlightRef.current = false;
        throw error;
      } finally {
        setChecking(false);
      }

      const runId = ++runIdRef.current;
      const sent = new Set<TimeRecord>();
      sentRef.current = sent;
      pendingResultRef.current = null;
      update({ ...IDLE_STATE, phase: 'sending', total: batch.length });

      const onProgress = (log: SendRecordLog) => {
        if (runId !== runIdRef.current) return;
        setState((previous) => ({ ...previous, processed: Math.min(previous.processed + 1, previous.total) }));
        const record = batch[log.index];
        if (!log.ok || !record) return;
        // Retira de borradores y de localStorage cada registro confirmado para que una recarga no lo reenvíe.
        sent.add(record);
        removeSent(sent);
      };

      sendAllRecords.execute(batch, onProgress).then(
        (result) => {
          if (runId !== runIdRef.current) return;
          pendingResultRef.current = result;
          void persistLogs(result, runId);
        },
        (error: unknown) => {
          if (runId !== runIdRef.current) return;
          inFlightRef.current = false;
          update({ phase: 'failed', failureMessage: errorMessageOf(error) });
        },
      );
      return { status: 'started' };
    },
    [getRecords, loadTemplates, loadLedger, domain, templates, sendAllRecords, removeSent, update, persistLogs],
  );

  const retrySendLogs = useCallback(() => {
    const result = pendingResultRef.current;
    if (!result || inFlightRef.current || phaseRef.current !== 'log-error') return;
    inFlightRef.current = true;
    void persistLogs(result, runIdRef.current);
  }, [persistLogs]);

  const { total, processed, successCount, errorCount, failureMessage, results } = state;
  const progress = useMemo<SendProgress>(
    () => ({ total, processed, percent: progressPercent(processed, total), successCount, errorCount, failureMessage, results }),
    [total, processed, successCount, errorCount, failureMessage, results],
  );

  return {
    phase: state.phase,
    locked: checking || isSendLocked(state.phase),
    checking,
    progress,
    isLocked,
    reset,
    sendAll,
    retrySendLogs,
    continueAfterSend: reset,
  };
}
