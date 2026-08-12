import { Observable } from 'rxjs';
import { TimeRecordApiBody, TimeRecordRegistrationResponse } from '../models/time-record-api.model';

export abstract class TimeRecordRepository {
  abstract register(body: TimeRecordApiBody): Observable<TimeRecordRegistrationResponse>;
  abstract getClientes(): Observable<string[]>;
  abstract getProyectos(cliente: string): Observable<string[]>;
  abstract getSolicitudes(cliente: string, proyecto: string): Observable<string[]>;
}
