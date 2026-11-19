import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { TimeRecordRegistrationResponse } from '@domain/time-records/models/time-record-api.model';
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

interface SendAttempt {
  response: TimeRecordRegistrationResponse | null;
  record: TimeRecord;
  index: number;
  error: unknown | null;
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

      let item: SendAttempt;
      try {
        const response = await this.registerRecord.execute(record);
        item = { response, record, index, error: null };
      } catch (error: unknown) {
        item = { response: null, record, index, error };
      }

      onProgress?.(this.buildLog(item));
      acc = this.accumulate(acc, item);
    }

    return acc;
  }

  private accumulate(acc: SendResult, item: SendAttempt): SendResult {
    const log = this.buildLog(item);
    if (item.error) {
      return {
        ...acc,
        errores: acc.errores + 1,
        erroresIndices: [...acc.erroresIndices, item.index],
        logs: [...acc.logs, log],
      };
    }

    const ok = this.isSuccessful(item.response);
    return ok
      ? {
          ...acc,
          enviados: acc.enviados + 1,
          enviadosIndices: [...acc.enviadosIndices, item.index],
          logs: [...acc.logs, log],
        }
      : {
          ...acc,
          errores: acc.errores + 1,
          erroresIndices: [...acc.erroresIndices, item.index],
          logs: [...acc.logs, log],
        };
  }

  private buildLog(item: SendAttempt): SendRecordLog {
    if (item.error) {
      return {
        index: item.index,
        ok: false,
        identificador: this.fallbackIdentifier(item.record, item.index),
        errorMessage: this.errorMessage(item.error),
      };
    }

    const response = item.response;
    const ok = this.isSuccessful(response);

    return {
      index: item.index,
      ok,
      identificador:
        this.extractIdentifier(response) || this.fallbackIdentifier(item.record, item.index),
      response: response || undefined,
      errorMessage: ok
        ? undefined
        : response?.mensaje || response?.message || 'Respuesta no confirmada',
    };
  }

  private extractIdentifier(response: TimeRecordRegistrationResponse | null): string {
    const candidates = [
      response?.identificador,
      response?.id,
      this.nestedString(response?.data, ['identificador']),
      this.nestedString(response?.data, ['id']),
      this.nestedString(response?.data, ['row', 'identificador']),
      this.nestedString(response?.registro, ['identificador']),
      this.nestedString(response?.tiempo, ['identificador']),
    ];

    const direct = candidates.find((value) => typeof value === 'string' && value.trim());
    if (direct) return direct.trim();

    const text = JSON.stringify(response || {});
    const match = text.match(/RH-[^"\\]+?DO-\d+/i);
    return match?.[0]?.trim() || '';
  }

  private isSuccessful(response: TimeRecordRegistrationResponse | null): boolean {
    return (
      response?.status === 200 ||
      (typeof response?.mensaje === 'string' &&
        response.mensaje.toLowerCase().includes('registrado'))
    );
  }

  private errorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') return 'Error al registrar';
    const value = error as Record<string, unknown>;
    return String(value['message'] || value['statusText'] || 'Error al registrar');
  }

  private nestedString(value: unknown, path: string[]): string {
    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[key];
    }
    return typeof current === 'string' ? current : '';
  }

  private fallbackIdentifier(record: TimeRecord | undefined, index: number): string {
    return record?.solicitud || record?.desc || `Registro ${index + 1}`;
  }
}
