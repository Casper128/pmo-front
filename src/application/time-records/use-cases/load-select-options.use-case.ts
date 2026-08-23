import { Observable } from 'rxjs';
import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
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

  solicitudOptions(cliente: string, proyecto: string): Observable<ManagementDemandOption[]> {
    return this.repository.getSolicitudOptions(cliente, proyecto);
  }
}
