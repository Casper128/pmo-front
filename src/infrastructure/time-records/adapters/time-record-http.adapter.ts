import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import { AuthGateway } from '@application/auth/auth.gateway';
import {
  TimeRecordApiBody,
  TimeRecordRegistrationResponse,
} from '@domain/time-records/models/time-record-api.model';
import { environment } from '@env/environment';

type CollectionResponse =
  | unknown[]
  | { clientes?: unknown[]; proyectos?: unknown[]; solicitudes?: unknown[]; data?: unknown[] };

@Injectable()
export class TimeRecordHttpAdapter implements TimeRecordRepository {
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
          const lista = Array.isArray(d) ? d : d.clientes || d.data || [];
          return lista.map((c) => this.optionValue(c, ['cliente', 'nombre', 'id'])).filter(Boolean);
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
          const lista = Array.isArray(d) ? d : d.proyectos || d.data || [];
          return lista
            .map((p) => this.optionValue(p, ['proyecto', 'nombre', 'id']))
            .filter(Boolean);
        }),
        catchError(() => of([])),
      );
  }

  getSolicitudes(cliente: string, proyecto: string): Observable<string[]> {
    return this.http
      .post<CollectionResponse>(
        `${environment.apiBaseUrl}/tiemposConsultores/solicitudes?cliente=${encodeURIComponent(cliente)}&proyecto=${encodeURIComponent(proyecto)}`,
        {},
        { headers: this.headers },
      )
      .pipe(
        map((d) => {
          const lista = Array.isArray(d) ? d : d.solicitudes || d.data || [];
          return lista
            .map((s) => this.optionValue(s, ['solicitud', 'gestion', 'numero', 'id']))
            .filter(Boolean);
        }),
        catchError(() => of([])),
      );
  }

  private optionValue(value: unknown, keys: string[]): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    const candidate = keys
      .map((key) => record[key])
      .find((item) => typeof item === 'string' || typeof item === 'number');
    return candidate === undefined ? '' : String(candidate);
  }
}
