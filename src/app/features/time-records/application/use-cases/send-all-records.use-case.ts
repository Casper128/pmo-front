import { Inject, Injectable } from '@angular/core';
import { Observable, from, reduce, mergeMap } from 'rxjs';
import { TimeRecord } from '../../domain/models/time-record.model';
import { TimeRecordDomainService } from '../../domain/services/time-record-domain.service';
import {
  ITimeRecordRepository,
  TIME_RECORD_REPOSITORY,
} from '../../domain/repositories/time-record.repository';

export interface SendResult {
  enviados: number;
  errores: number;
}

@Injectable()
export class SendAllRecordsUseCase {
  constructor(
    @Inject(TIME_RECORD_REPOSITORY) private repo: ITimeRecordRepository,
    private domain: TimeRecordDomainService
  ) {}

  execute(records: TimeRecord[]): Observable<SendResult> {
    return from(records).pipe(
      mergeMap(reg => {
        const body = this.domain.buildApiBody(reg);
        return this.repo.registrar(body);
      }, 3), // concurrency 3
      reduce(
        (acc, res: any) => {
          const ok =
            res?.status === 200 ||
            (res?.mensaje && res.mensaje.toLowerCase().includes('registrado'));
          return ok
            ? { ...acc, enviados: acc.enviados + 1 }
            : { ...acc, errores: acc.errores + 1 };
        },
        { enviados: 0, errores: 0 } as SendResult
      )
    );
  }
}
