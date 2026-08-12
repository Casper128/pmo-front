import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';
import { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import {
  TimeRecordApiBody,
  TimeRecordRegistrationResponse,
} from '@domain/time-records/models/time-record-api.model';
import { TimeRecord } from '@domain/time-records/models/time-record.model';
import { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';

export class RegisterTimeRecordUseCase {
  constructor(
    private readonly repository: TimeRecordRepository,
    private readonly location: LocationGateway,
    private readonly audit: UserAuditGateway,
    private readonly domain: TimeRecordDomainService,
  ) {}

  execute(record: TimeRecord): Observable<TimeRecordRegistrationResponse> {
    const body = this.domain.buildApiBody(record);
    return from(
      this.location.capture({ highAccuracy: true, maximumAgeMs: 0, timeoutMs: 15000 }),
    ).pipe(
      switchMap((location) =>
        this.repository.register(body).pipe(
          switchMap((response) => this.auditResult(location, body, true).pipe(map(() => response))),
          catchError((error) =>
            this.auditResult(location, body, false).pipe(switchMap(() => throwError(() => error))),
          ),
        ),
      ),
    );
  }

  private auditResult(
    location: Awaited<ReturnType<LocationGateway['capture']>>,
    body: TimeRecordApiBody,
    successful: boolean,
  ): Observable<void> {
    return this.audit
      .recordTimeReport(
        location,
        {
          reference: body.solicitud,
          customer: body.cliente,
          date: body.HoraInicio.slice(0, 10),
        },
        successful,
      )
      .pipe(catchError(() => of(undefined)));
  }
}
