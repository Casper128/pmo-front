import { Observable } from 'rxjs';
import { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';

export class LoadSelectOptionsUseCase {
  constructor(private readonly repository: TimeRecordRepository) {}

  clientes(): Observable<string[]> {
    return this.repository.getClientes();
  }

  proyectos(cliente: string): Observable<string[]> {
    return this.repository.getProyectos(cliente);
  }

  solicitudes(cliente: string, proyecto: string): Observable<string[]> {
    return this.repository.getSolicitudes(cliente, proyecto);
  }
}
