import type { AuthGateway } from '@application/auth/auth.gateway';
import { ManagementDeleteRequestGateway } from '@application/time-records/ports/management-delete-request.gateway';
import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import type { Environment } from '@env/environment';
import type { HttpClient } from '../../http/http-client';

type DeleteRequestRow = Record<string, unknown>;

/** Solicitudes de eliminación (auditoría) en la función Supabase `pmo-management-delete-request`. */
export class ManagementDeleteRequestAdapter extends ManagementDeleteRequestGateway {
  private readonly endpoint: string;
  private readonly http: HttpClient;
  private readonly auth: AuthGateway;
  private readonly env: Environment;

  constructor(http: HttpClient, auth: AuthGateway, env: Environment) {
    super();
    this.http = http;
    this.auth = auth;
    this.env = env;
    this.endpoint = `${env.supabaseUrl}/functions/v1/pmo-management-delete-request`;
  }

  list(): Promise<ManagementDeleteRequest[]> {
    return this.fetchRequests(this.endpoint);
  }

  listMine(): Promise<ManagementDeleteRequest[]> {
    return this.fetchRequests(`${this.endpoint}?scope=mine`);
  }

  private async fetchRequests(url: string): Promise<ManagementDeleteRequest[]> {
    const payload = await this.http.get<{ requests?: DeleteRequestRow[] }>(url, { headers: this.headers });
    return (payload.requests || []).map((row) => this.mapRow(row));
  }

  async mark(id: string, status: 'approved' | 'rejected'): Promise<ManagementDeleteRequest> {
    const payload = await this.http.patch<{ request?: DeleteRequestRow }>(
      this.endpoint,
      { id, status },
      { headers: this.headers },
    );
    return this.mapRow(payload.request || {});
  }

  private get headers(): Record<string, string> {
    return {
      apikey: this.env.supabasePublishableKey,
      Authorization: `Bearer ${this.auth.token || ''}`,
      'Content-Type': 'application/json',
    };
  }

  private mapRow(row: DeleteRequestRow): ManagementDeleteRequest {
    const report =
      row['report'] && typeof row['report'] === 'object'
        ? (row['report'] as ManagementDeleteRequest['report'])
        : {};
    return {
      id: String(row['id'] || ''),
      identifier: String(row['identifier'] || ''),
      requesterKey: String(row['requester_key'] || ''),
      requesterEmail: String(row['requester_email'] || ''),
      auditorEmail: String(row['auditor_email'] || ''),
      report,
      status: this.status(row['status']),
      requestedAt: String(row['requested_at'] || ''),
      reviewedAt: this.optionalString(row['reviewed_at']),
      reviewedBy: this.optionalString(row['reviewed_by']),
      reviewNote: this.optionalString(row['review_note']),
    };
  }

  private status(value: unknown): ManagementDeleteRequest['status'] {
    return value === 'approved' || value === 'rejected' || value === 'cancelled' ? value : 'pending';
  }

  private optionalString(value: unknown): string | undefined {
    const text = String(value || '').trim();
    return text || undefined;
  }
}
