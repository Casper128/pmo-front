import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { AuthGateway } from '@application/auth/auth.gateway';
import { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import {
  ManagementReport,
  ReportDownloadFilter,
  ReportDownloadResponse,
} from '@domain/time-records/models/management-report.model';

@Injectable()
export class TimeManagementHttpAdapter implements TimeManagementGateway {
  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthGateway,
  ) {}

  list(consultantId: string | number | null): Observable<ManagementReport[]> {
    return this.http
      .post<unknown>(
        `${environment.apiBaseUrl}/tiemposConsultores/gestion`,
        { idConsultor: consultantId },
        { headers: this.headers },
      )
      .pipe(map((response) => this.extractRows(response)));
  }

  update(identifier: string, body: Record<string, unknown>): Observable<void> {
    return this.http
      .post<unknown>(
        `${environment.supabaseUrl}/functions/v1/pmo-management-edit`,
        { identifier, changes: body },
        {
          headers: {
            ...this.headers,
            apikey: environment.supabasePublishableKey,
            'Content-Type': 'application/json',
          },
        },
      )
      .pipe(map(() => undefined));
  }

  download(filter: ReportDownloadFilter): Observable<ReportDownloadResponse> {
    return this.http
      .post<unknown>(`${environment.apiBaseUrl}/tiemposConsultores/filtroDownload`, filter, {
        headers: this.headers,
      })
      .pipe(map((response) => this.extractDownload(response)));
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.auth.token || ''}` };
  }

  private extractRows(response: unknown): ManagementReport[] {
    if (Array.isArray(response)) return response.filter(this.isRecord);
    const root = this.asRecord(response);
    const data = this.asRecord(root?.['data']);
    const candidates = [data?.['rows'], root?.['data'], root?.['rows']];
    const rows = candidates.find(Array.isArray);
    return Array.isArray(rows) ? rows.filter(this.isRecord) : [];
  }

  private extractDownload(response: unknown): ReportDownloadResponse {
    const record = this.asRecord(response);
    return {
      excel: typeof record?.['excel'] === 'string' ? record['excel'] : undefined,
      mensaje: typeof record?.['mensaje'] === 'string' ? record['mensaje'] : undefined,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private isRecord(value: unknown): value is ManagementReport {
    return value !== null && typeof value === 'object';
  }
}
