import type { AuthGateway } from '@application/auth/auth.gateway';
import type { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import type {
  CreateSendLog,
  SendLog,
  SendLogCollection,
  SendLogQuery,
} from '@domain/time-records/models/send-log.model';
import type { Environment } from '@env/environment';
import type { HttpClient } from '../../http/http-client';

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

/** Historial de envíos en la función Supabase `pmo-send-logs`. */
export class SupabaseSendLogAdapter implements SendLogGateway {
  private readonly endpoint: string;
  private readonly http: HttpClient;
  private readonly auth: AuthGateway;
  private readonly env: Environment;

  constructor(http: HttpClient, auth: AuthGateway, env: Environment) {
    this.http = http;
    this.auth = auth;
    this.env = env;
    this.endpoint = `${env.supabaseUrl}/functions/v1/pmo-send-logs`;
  }

  async create(log: CreateSendLog): Promise<void> {
    await this.http.post<unknown>(this.endpoint, log, { headers: this.headers() });
  }

  async createMany(logs: CreateSendLog[]): Promise<void> {
    await this.http.post<unknown>(this.endpoint, { logs }, { headers: this.headers() });
  }

  async list(query: SendLogQuery): Promise<SendLogCollection> {
    const response = await this.http.get<SendLogResponse>(this.endpoint, {
      headers: this.headers(),
      params: { from: query.dateFrom, to: query.dateTo, scope: query.scope ?? 'own' },
    });
    return {
      logs: (response.logs ?? []).map((row) => this.toDomain(row)),
      isAdmin: response.isAdmin === true,
      retentionDays: response.retentionDays ?? 90,
    };
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.env.supabasePublishableKey,
      Authorization: `Bearer ${this.auth.token ?? ''}`,
      'Content-Type': 'application/json',
    };
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
