import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthGateway } from '@application/auth/auth.gateway';
import { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import {
  CreateSendLog,
  SendLog,
  SendLogCollection,
  SendLogQuery,
} from '@domain/time-records/models/send-log.model';
import { environment } from '@env/environment';

interface SendLogRow {
  id: string;
  user_key: string;
  user_email: string;
  item_index: number;
  successful: boolean;
  reference: string;
  error_message: string | null;
  occurred_at: string;
  week_start: string;
  week_end: string;
  expires_at: string;
}

interface SendLogResponse {
  logs?: SendLogRow[];
  isAdmin?: boolean;
  retentionDays?: number;
}

@Injectable()
export class SupabaseSendLogAdapter implements SendLogGateway {
  private readonly endpoint = `${environment.supabaseUrl}/functions/v1/pmo-send-logs`;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthGateway,
  ) {}

  create(log: CreateSendLog): Observable<void> {
    return this.http
      .post<unknown>(this.endpoint, log, { headers: this.headers() })
      .pipe(map(() => undefined));
  }

  createMany(logs: CreateSendLog[]): Observable<void> {
    return this.http
      .post<unknown>(this.endpoint, { logs }, { headers: this.headers() })
      .pipe(map(() => undefined));
  }

  list(query: SendLogQuery): Observable<SendLogCollection> {
    const params = new HttpParams()
      .set('from', query.dateFrom)
      .set('to', query.dateTo)
      .set('scope', query.scope ?? 'own');
    return this.http.get<SendLogResponse>(this.endpoint, { headers: this.headers(), params }).pipe(
      map((response) => ({
        logs: (response.logs ?? []).map((row) => this.toDomain(row)),
        isAdmin: response.isAdmin === true,
        retentionDays: response.retentionDays ?? 90,
      })),
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      apikey: environment.supabasePublishableKey,
      Authorization: `Bearer ${this.auth.token ?? ''}`,
      'Content-Type': 'application/json',
    });
  }

  private toDomain(row: SendLogRow): SendLog {
    return {
      id: row.id,
      userKey: row.user_key,
      userEmail: row.user_email,
      itemIndex: row.item_index,
      successful: row.successful,
      reference: row.reference,
      errorMessage: row.error_message ?? '',
      occurredAt: row.occurred_at,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      expiresAt: row.expires_at,
    };
  }
}
