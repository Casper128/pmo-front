import { Provider } from '@angular/core';
import { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { RegisterTimeRecordUseCase } from '@application/time-records/use-cases/register-time-record.use-case';
import { SendAllRecordsUseCase } from '@application/time-records/use-cases/send-all-records.use-case';
import { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { TimeManagementHttpAdapter } from '@infrastructure/time-records/adapters/time-management-http.adapter';
import { TimeRecordHttpAdapter } from '@infrastructure/time-records/adapters/time-record-http.adapter';
import { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import { SupabaseSendLogAdapter } from '@infrastructure/time-records/adapters/supabase-send-log.adapter';

export const TIME_RECORDS_PROVIDERS: Provider[] = [
  {
    provide: TimeRecordRepository,
    useClass: TimeRecordHttpAdapter,
  },
  {
    provide: TimeManagementGateway,
    useClass: TimeManagementHttpAdapter,
  },
  {
    provide: SendLogGateway,
    useClass: SupabaseSendLogAdapter,
  },
  {
    provide: TimeRecordDomainService,
    useFactory: (parameters: AppParametersFacade) => new TimeRecordDomainService(parameters),
    deps: [AppParametersFacade],
  },
  {
    provide: RegisterTimeRecordUseCase,
    useFactory: (
      repository: TimeRecordRepository,
      location: LocationGateway,
      audit: UserAuditGateway,
      domain: TimeRecordDomainService,
    ) => new RegisterTimeRecordUseCase(repository, location, audit, domain),
    deps: [TimeRecordRepository, LocationGateway, UserAuditGateway, TimeRecordDomainService],
  },
  {
    provide: SendAllRecordsUseCase,
    useFactory: (register: RegisterTimeRecordUseCase) => new SendAllRecordsUseCase(register),
    deps: [RegisterTimeRecordUseCase],
  },
  {
    provide: LoadSelectOptionsUseCase,
    useFactory: (repository: TimeRecordRepository) => new LoadSelectOptionsUseCase(repository),
    deps: [TimeRecordRepository],
  },
];
