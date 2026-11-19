import {
  Observable,
  catchError,
  concatMap,
  from,
  map,
  of,
  reduce,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { TimeRecord } from '@domain/time-records/models/time-record.model';
import { TimeRecordRegistrationResponse } from '@domain/time-records/models/time-record-api.model';
import { RegisterTimeRecordUseCase } from './register-time-record.use-case';

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

export class SendAllRecordsUseCase {
  constructor(private readonly registerRecord: RegisterTimeRecordUseCase) {}

  execute(
    records: TimeRecord[],
    onProgress?: (log: SendRecordLog) => void,
  ): Observable<SendResult> {
    return from(records.map((record, index) => ({ record, index }))).pipe(
      concatMap(({ record, index }) =>
        timer(index === 0 ? 0 : 900).pipe(
          switchMap(() => {
            return this.registerRecord
              .execute(record)
              .pipe(
                map((response) => ({ response, record, index, error: null }) satisfies SendAttempt),
              );
          }),
          catchError((error: unknown) =>
            of({ response: null, record, index, error } satisfies SendAttempt),
          ),
        ),
      ),
      tap((item) => onProgress?.(this.buildLog(item))),
      reduce(
        (acc, item) => {
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
        },
        {
          enviados: 0,
          errores: 0,
          enviadosIndices: [],
          erroresIndices: [],
          logs: [],
        } as SendResult,
      ),
    );
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
