import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import { interpretRegistration } from '../registration-outcome';
import type { RegisterTimeRecordUseCase } from './register-time-record.use-case';

export interface SendResult {
  enviados: number;
  errores: number;
  enviadosIndices: number[];
  erroresIndices: number[];
  logs: SendRecordLog[];
}

export interface SendRecordLog {
  index: number;
  ok: boolean;
  identificador: string;
  response?: unknown;
  errorMessage?: string;
}

/** Espera entre registros consecutivos (paridad con `timer(900)` de Angular). */
export const SEND_DELAY_MS = 900;

/** Espera `ms` milisegundos; si `signal` se aborta, rechaza de inmediato con `signal.reason`. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class SendAllRecordsUseCase {
  private readonly registerRecord: RegisterTimeRecordUseCase;

  constructor(registerRecord: RegisterTimeRecordUseCase) {
    this.registerRecord = registerRecord;
  }

  /**
   * Envía los registros uno a uno, esperando 900 ms antes de cada registro salvo el primero. Un
   * error en un registro no detiene el lote. `onProgress` se invoca tras cada intento.
   * `signal` sustituye a `unsubscribe`: se revisa antes de cada registro y durante la espera (no
   * cancela una petición ya enviada); al abortar, la promesa rechaza con `signal.reason`.
   * El lote se copia al inicio: mutar `records` durante el envío no salta registros ni desalinea
   * `log.index` (los índices se refieren siempre al lote original).
   */
  async execute(
    records: TimeRecord[],
    onProgress?: (log: SendRecordLog) => void,
    signal?: AbortSignal,
  ): Promise<SendResult> {
    let acc: SendResult = {
      enviados: 0,
      errores: 0,
      enviadosIndices: [],
      erroresIndices: [],
      logs: [],
    };

    const batch = [...records];
    for (const [index, record] of batch.entries()) {
      signal?.throwIfAborted();
      if (index > 0) await delay(SEND_DELAY_MS, signal);

      const log = await this.attempt(record, index);
      onProgress?.(log);
      acc = this.accumulate(acc, log);
    }

    return acc;
  }

  /** Registra un tiempo y construye su log una sola vez; un error no se propaga, se refleja en el log. */
  private async attempt(record: TimeRecord, index: number): Promise<SendRecordLog> {
    try {
      const response = await this.registerRecord.execute(record);
      const outcome = interpretRegistration(response);
      return {
        index,
        ok: outcome.ok,
        identificador: outcome.identifier || this.fallbackIdentifier(record, index),
        response: response || undefined,
        errorMessage: outcome.ok ? undefined : outcome.message,
      };
    } catch (error: unknown) {
      return {
        index,
        ok: false,
        identificador: this.fallbackIdentifier(record, index),
        errorMessage: this.errorMessage(error),
      };
    }
  }

  private accumulate(acc: SendResult, log: SendRecordLog): SendResult {
    return log.ok
      ? {
          ...acc,
          enviados: acc.enviados + 1,
          enviadosIndices: [...acc.enviadosIndices, log.index],
          logs: [...acc.logs, log],
        }
      : {
          ...acc,
          errores: acc.errores + 1,
          erroresIndices: [...acc.erroresIndices, log.index],
          logs: [...acc.logs, log],
        };
  }

  private errorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') return 'Error al registrar';
    const value = error as Record<string, unknown>;
    return String(value['message'] || value['statusText'] || 'Error al registrar');
  }

  private fallbackIdentifier(record: TimeRecord | undefined, index: number): string {
    return record?.solicitud || record?.desc || `Registro ${index + 1}`;
  }
}
