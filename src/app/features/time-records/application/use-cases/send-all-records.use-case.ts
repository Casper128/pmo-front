import { Inject, Injectable } from '@angular/core';
import { Observable, catchError, concatMap, from, map, of, reduce, switchMap, tap, timer } from 'rxjs';
import { TimeRecord } from '../../domain/models/time-record.model';
import { TimeRecordDomainService } from '../../domain/services/time-record-domain.service';
import {
  ITimeRecordRepository,
  TIME_RECORD_REPOSITORY,
} from '../../domain/repositories/time-record.repository';

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

@Injectable()
export class SendAllRecordsUseCase {
  constructor(
    @Inject(TIME_RECORD_REPOSITORY) private repo: ITimeRecordRepository,
    private domain: TimeRecordDomainService
  ) {}

  execute(records: TimeRecord[], onProgress?: (log: SendRecordLog) => void): Observable<SendResult> {
    return from(records.map((record, index) => ({ record, index }))).pipe(
      concatMap(({ record, index }) => timer(index === 0 ? 0 : 900).pipe(
        switchMap(() => {
          const body = this.domain.buildApiBody(record);
          return this.repo.registrar(body).pipe(
            map(res => ({ res, record, index, error: null }))
          );
        }),
        catchError(error => of({ res: null, record, index, error }))
      )),
      tap((item: any) => onProgress?.(this.buildLog(item))),
      reduce(
        (acc, item: any) => {
          const log = this.buildLog(item);
          if (item.error) {
            return {
              ...acc,
              errores: acc.errores + 1,
              erroresIndices: [...acc.erroresIndices, item.index],
              logs: [...acc.logs, log],
            };
          }

          const res = item.res;
          const ok =
            res?.status === 200 ||
            (res?.mensaje && res.mensaje.toLowerCase().includes('registrado'));
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
        { enviados: 0, errores: 0, enviadosIndices: [], erroresIndices: [], logs: [] } as SendResult
      )
    );
  }

  private buildLog(item: any): SendRecordLog {
    if (item.error) {
      return {
        index: item.index,
        ok: false,
        identificador: this.fallbackIdentifier(item.record, item.index),
        errorMessage: item.error?.message || item.error?.statusText || 'Error al registrar',
      };
    }

    const res = item.res;
    const ok =
      res?.status === 200 ||
      (res?.mensaje && res.mensaje.toLowerCase().includes('registrado'));

    return {
      index: item.index,
      ok,
      identificador: this.extractIdentifier(res) || this.fallbackIdentifier(item.record, item.index),
      response: res,
      errorMessage: ok ? undefined : (res?.mensaje || res?.message || 'Respuesta no confirmada'),
    };
  }

  private extractIdentifier(response: any): string {
    const candidates = [
      response?.identificador,
      response?.id,
      response?.data?.identificador,
      response?.data?.id,
      response?.data?.row?.identificador,
      response?.registro?.identificador,
      response?.tiempo?.identificador,
    ];

    const direct = candidates.find(value => typeof value === 'string' && value.trim());
    if (direct) return direct.trim();

    const text = JSON.stringify(response || {});
    const match = text.match(/RH-[^"\\]+?DO-\d+/i);
    return match?.[0]?.trim() || '';
  }

  private fallbackIdentifier(record: TimeRecord | undefined, index: number): string {
    return record?.solicitud || record?.desc || `Registro ${index + 1}`;
  }
}
