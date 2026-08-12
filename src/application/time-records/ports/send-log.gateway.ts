import { Observable } from 'rxjs';
import {
  CreateSendLog,
  SendLogCollection,
  SendLogQuery,
} from '@domain/time-records/models/send-log.model';

export abstract class SendLogGateway {
  abstract create(log: CreateSendLog): Observable<void>;
  abstract createMany(logs: CreateSendLog[]): Observable<void>;
  abstract list(query: SendLogQuery): Observable<SendLogCollection>;
}
