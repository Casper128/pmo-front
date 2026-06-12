import { Provider } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TIME_RECORD_REPOSITORY } from './domain/repositories/time-record.repository';
import { TimeRecordHttpAdapter } from './infrastructure/adapters/time-record-http.adapter';
import { TimeRecordDomainService } from './domain/services/time-record-domain.service';
import { SendAllRecordsUseCase } from './application/use-cases/send-all-records.use-case';
import { LoadSelectOptionsUseCase } from './application/use-cases/load-select-options.use-case';
import { AuthService } from '../../core/auth/auth.service';

export const TIME_RECORDS_PROVIDERS: Provider[] = [
  TimeRecordDomainService,
  {
    provide: TIME_RECORD_REPOSITORY,
    useFactory: (http: HttpClient, auth: AuthService) =>
      new TimeRecordHttpAdapter(http, auth),
    deps: [HttpClient, AuthService],
  },
  SendAllRecordsUseCase,
  LoadSelectOptionsUseCase,
];
