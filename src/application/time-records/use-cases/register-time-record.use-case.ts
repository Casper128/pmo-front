import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';
import { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import {
  TimeRecordApiBody,
  TimeRecordRegistrationResponse,
} from '@domain/time-records/models/time-record-api.model';
import { TimeRecord } from '@domain/time-records/models/time-record.model';
import { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import { TimeRecordApiBodyBuilder } from '@domain/time-records/services/time-record-api-body.builder';
import { ManagementTemplateGateway } from '../ports/management-template.gateway';
import {
  AdvancedTemplateFieldKey,
  AdvancedTemplateValues,
} from '@domain/time-records/models/management-template.model';

export class RegisterTimeRecordUseCase {
  constructor(
    private readonly repository: TimeRecordRepository,
    private readonly location: LocationGateway,
    private readonly audit: UserAuditGateway,
    private readonly templates: ManagementTemplateGateway,
    private readonly bodyBuilder: TimeRecordApiBodyBuilder,
  ) {}

  execute(record: TimeRecord): Observable<TimeRecordRegistrationResponse> {
    return this.templates.get(record.gestionId || record.solicitud).pipe(
      map((template) => this.applyTemplate(record, template?.values || {})),
      map((preparedRecord) => this.bodyBuilder.build(preparedRecord)),
      switchMap((body) =>
        from(this.location.capture({ highAccuracy: true, maximumAgeMs: 0, timeoutMs: 15000 })).pipe(
          map((capturedLocation) => ({ capturedLocation, body })),
        ),
      ),
      switchMap(({ capturedLocation, body }) =>
        this.repository.register(body).pipe(
          switchMap((response) =>
            this.auditResult(capturedLocation, body, true).pipe(map(() => response)),
          ),
          catchError((error) =>
            this.auditResult(capturedLocation, body, false).pipe(
              switchMap(() => throwError(() => error)),
            ),
          ),
        ),
      ),
    );
  }

  private applyTemplate(
    record: TimeRecord,
    values: AdvancedTemplateValues,
  ): TimeRecord & AdvancedTemplateValues {
    const copy: TimeRecord & AdvancedTemplateValues = { ...record };
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'tipoHora') return;
      if (value === undefined || value === null || String(value).trim() === '') return;
      copy[key as AdvancedTemplateFieldKey] = String(value);
    });
    return copy;
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
