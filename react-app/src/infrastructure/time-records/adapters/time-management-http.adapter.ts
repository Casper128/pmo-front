import type { AuthGateway } from '@application/auth/auth.gateway';
import type {
  DeleteRequestBody,
  TechnicalDeleteBody,
  TimeManagementGateway,
} from '@application/time-records/ports/time-management.gateway';
import type {
  ManagementReport,
  ReportDownloadFilter,
  ReportDownloadResponse,
} from '@domain/time-records/models/management-report.model';
import type { Environment } from '@env/environment';
import type { HttpClient } from '../../http/http-client';

/** Gestión de reportes: listado y descarga en la API PMO; edición y borrados en funciones Supabase. */
export class TimeManagementHttpAdapter implements TimeManagementGateway {
  private readonly http: HttpClient;
  private readonly auth: AuthGateway;
  private readonly env: Environment;

  constructor(http: HttpClient, auth: AuthGateway, env: Environment) {
    this.http = http;
    this.auth = auth;
    this.env = env;
  }

  async list(consultantId: string | number | null): Promise<ManagementReport[]> {
    const response = await this.http.post<unknown>(
      `${this.env.apiBaseUrl}/tiemposConsultores/gestion`,
      { idConsultor: consultantId },
      { headers: this.headers },
    );
    return this.extractRows(response);
  }

  async update(identifier: string, body: Record<string, unknown>): Promise<void> {
    await this.postSupabase('pmo-management-edit', { identifier, changes: body });
  }

  async delete(identifier: string): Promise<void> {
    await this.postSupabase('pmo-management-delete', { identifier });
  }

  async requestDelete(body: DeleteRequestBody): Promise<void> {
    await this.postSupabase('pmo-management-delete-request', body);
  }

  async technicalDelete(body: TechnicalDeleteBody): Promise<void> {
    await this.postSupabase('pmo-management-delete-technical', body);
  }

  async download(filter: ReportDownloadFilter): Promise<ReportDownloadResponse> {
    const response = await this.http.post<unknown>(
      `${this.env.apiBaseUrl}/tiemposConsultores/filtroDownload`,
      filter,
      { headers: this.headers },
    );
    return this.extractDownload(response);
  }

  private postSupabase(functionName: string, body: object): Promise<unknown> {
    return this.http.post<unknown>(`${this.env.supabaseUrl}/functions/v1/${functionName}`, body, {
      headers: {
        ...this.headers,
        apikey: this.env.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
    });
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
