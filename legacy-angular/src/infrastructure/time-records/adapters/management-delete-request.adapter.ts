import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthGateway } from '@application/auth/auth.gateway';
import { ManagementDeleteRequestGateway } from '@application/time-records/ports/management-delete-request.gateway';
import { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import { environment } from '@env/environment';

type DeleteRequestRow = Record<string, unknown>;

@Injectable()
export class ManagementDeleteRequestAdapter extends ManagementDeleteRequestGateway {
  private readonly endpoint = `${environment.supabaseUrl}/functions/v1/pmo-management-delete-request`;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthGateway,
  ) {
    super();
  }

  list(): Observable<ManagementDeleteRequest[]> {
    return this.http
      .get<{ requests?: DeleteRequestRow[] }>(this.endpoint, { headers: this.headers })
      .pipe(map((payload) => (payload.requests || []).map((row) => this.mapRow(row))));
  }

  mark(id: string, status: 'approved' | 'rejected'): Observable<ManagementDeleteRequest> {
    return this.http
      .patch<{ request?: DeleteRequestRow }>(
        this.endpoint,
        { id, status },
        { headers: this.headers },
      )
      .pipe(map((payload) => this.mapRow(payload.request || {})));
  }

  private get headers(): Record<string, string> {
    return {
      apikey: environment.supabasePublishableKey,
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
    return value === 'approved' || value === 'rejected' || value === 'cancelled'
      ? value
      : 'pending';
  }

  private optionalString(value: unknown): string | undefined {
    const text = String(value || '').trim();
    return text || undefined;
  }
}
