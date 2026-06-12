import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ITimeRecordRepository,
  TIME_RECORD_REPOSITORY,
} from '../../domain/repositories/time-record.repository';

@Injectable()
export class LoadSelectOptionsUseCase {
  constructor(@Inject(TIME_RECORD_REPOSITORY) private repo: ITimeRecordRepository) {}

  clientes(): Observable<string[]> {
    return this.repo.getClientes();
  }

  proyectos(cliente: string): Observable<string[]> {
    return this.repo.getProyectos(cliente);
  }

  solicitudes(cliente: string, proyecto: string): Observable<string[]> {
    return this.repo.getSolicitudes(cliente, proyecto);
  }
}
