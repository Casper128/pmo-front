import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import { AuthGateway } from '@application/auth/auth.gateway';
import {
  TimeRecordApiBody,
  TimeRecordRegistrationResponse,
} from '@domain/time-records/models/time-record-api.model';
import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import { environment } from '@env/environment';
import { TimeRecordOptionsMapper } from '../mappers/time-record-options.mapper';

type CollectionResponse =
  | unknown[]
  | { clientes?: unknown[]; proyectos?: unknown[]; solicitudes?: unknown[]; data?: unknown[] };

@Injectable()
export class TimeRecordHttpAdapter implements TimeRecordRepository {
  private readonly mapper = new TimeRecordOptionsMapper();

  constructor(
    private http: HttpClient,
    private auth: AuthGateway,
  ) {}

  private get headers() {
    return { Authorization: `Bearer ${this.auth.token}` };
  }

  register(body: TimeRecordApiBody): Observable<TimeRecordRegistrationResponse> {
    return this.http.post<TimeRecordRegistrationResponse>(
      `${environment.apiBaseUrl}/tiemposConsultores/registrar`,
      body,
      { headers: this.headers },
    );
  }

  getClientes(): Observable<string[]> {
    return this.http
      .post<CollectionResponse>(
        `${environment.apiBaseUrl}/tiemposConsultores/clientes`,
        {},
        { headers: this.headers },
      )
      .pipe(
        map((d) => {
          const lista = this.mapper.collection(d, 'clientes');
          return lista.map((c) => this.mapper.optionValue(c, ['cliente', 'nombre', 'id'])).filter(Boolean);
        }),
        catchError(() => of([])),
      );
  }

  getProyectos(cliente: string): Observable<string[]> {
    return this.http
      .post<CollectionResponse>(
        `${environment.apiBaseUrl}/tiemposConsultores/proyectos/${encodeURIComponent(cliente)}`,
        {},
        { headers: this.headers },
      )
      .pipe(
        map((d) => {
          const lista = this.mapper.collection(d, 'proyectos');
          return lista
            .map((p) => this.mapper.optionValue(p, ['proyecto', 'nombre', 'id']))
            .filter(Boolean);
        }),
        catchError(() => of([])),
      );
  }

  getSolicitudes(cliente: string, proyecto: string): Observable<string[]> {
    return this.getSolicitudOptions(cliente, proyecto).pipe(
      map((options) => options.map((s) => s.requestValue || s.name)),
    );
  }

  getSolicitudOptions(cliente: string, proyecto: string): Observable<ManagementDemandOption[]> {
    return this.http
      .post<CollectionResponse>(
        `${environment.apiBaseUrl}/tiemposConsultores/solicitudes?cliente=${encodeURIComponent(cliente)}&proyecto=${encodeURIComponent(proyecto)}`,
        {},
        { headers: this.headers },
      )
      .pipe(
        map((d) => {
          const lista = this.mapper.collection(d, 'solicitudes');
          return lista.map((s) => this.mapper.demandOption(s)).filter((s) => s.id && s.name);
        }),
        catchError(() => of([])),
      );
  }
}
