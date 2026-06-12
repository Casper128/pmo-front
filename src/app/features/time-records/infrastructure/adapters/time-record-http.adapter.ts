import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { ITimeRecordRepository } from '../../domain/repositories/time-record.repository';
import { AuthService } from '../../../../core/auth/auth.service';

const BASE = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';

@Injectable()
export class TimeRecordHttpAdapter implements ITimeRecordRepository {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return { Authorization: `Bearer ${this.auth.token}` };
  }

  registrar(body: object): Observable<any> {
    return this.http.post(`${BASE}/tiemposConsultores/registrar`, body, { headers: this.headers });
  }

  getClientes(): Observable<string[]> {
    return this.http
      .post<any>(`${BASE}/tiemposConsultores/clientes`, {}, { headers: this.headers })
      .pipe(
        map(d => {
          const lista: any[] = Array.isArray(d) ? d : (d.clientes || d.data || []);
          return lista
            .map(c => (typeof c === 'string' ? c : c.cliente || c.nombre || c.id || ''))
            .filter(Boolean);
        }),
        catchError(() => of([]))
      );
  }

  getProyectos(cliente: string): Observable<string[]> {
    return this.http
      .post<any>(
        `${BASE}/tiemposConsultores/proyectos/${encodeURIComponent(cliente)}`,
        {},
        { headers: this.headers }
      )
      .pipe(
        map(d => {
          const lista: any[] = Array.isArray(d) ? d : (d.proyectos || d.data || []);
          return lista
            .map(p => (typeof p === 'string' ? p : p.proyecto || p.nombre || p.id || ''))
            .filter(Boolean);
        }),
        catchError(() => of([]))
      );
  }

  getSolicitudes(cliente: string, proyecto: string): Observable<string[]> {
    return this.http
      .post<any>(
        `${BASE}/tiemposConsultores/solicitudes?cliente=${encodeURIComponent(cliente)}&proyecto=${encodeURIComponent(proyecto)}`,
        {},
        { headers: this.headers }
      )
      .pipe(
        map(d => {
          const lista: any[] = Array.isArray(d) ? d : (d.solicitudes || d.data || []);
          return lista
            .map(s =>
              typeof s === 'string' ? s : s.solicitud || s.gestion || s.numero || s.id || ''
            )
            .filter(Boolean);
        }),
        catchError(() => of([]))
      );
  }
}
