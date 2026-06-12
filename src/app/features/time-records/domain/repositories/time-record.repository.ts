import { Observable } from 'rxjs';

export interface ITimeRecordRepository {
  registrar(body: object): Observable<{ status?: number; mensaje?: string; message?: string }>;
  getClientes(): Observable<string[]>;
  getProyectos(cliente: string): Observable<string[]>;
  getSolicitudes(cliente: string, proyecto: string): Observable<string[]>;
}

export const TIME_RECORD_REPOSITORY = 'TIME_RECORD_REPOSITORY';
