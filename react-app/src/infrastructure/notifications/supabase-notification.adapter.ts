import type { AuthGateway } from '@application/auth/auth.gateway';
import {
  NotificationGateway,
  type AppNotification,
  type NotificationFeed,
} from '@application/notifications/notification.gateway';
import type { Environment } from '@env/environment';
import type { HttpClient } from '../http/http-client';

/** Máximo de notificaciones que se piden en cada consulta (el servidor admite hasta 50). */
const LIST_LIMIT = 20;

type NotificationRow = Record<string, unknown>;

/** Notificaciones en la función Supabase `pmo-notifications`. */
export class SupabaseNotificationAdapter extends NotificationGateway {
  private readonly endpoint: string;
  private readonly http: HttpClient;
  private readonly auth: AuthGateway;
  private readonly env: Environment;

  constructor(http: HttpClient, auth: AuthGateway, env: Environment) {
    super();
    this.http = http;
    this.auth = auth;
    this.env = env;
    this.endpoint = `${env.supabaseUrl}/functions/v1/pmo-notifications`;
  }

  async listUnread(): Promise<NotificationFeed> {
    const payload = await this.http.get<{ notifications?: NotificationRow[]; unreadCount?: number }>(
      `${this.endpoint}?unread=1&limit=${LIST_LIMIT}`,
      { headers: this.headers },
    );
    const notifications = (payload.notifications || []).map((row) => this.mapRow(row));
    return { notifications, unreadCount: Number(payload.unreadCount) || 0 };
  }

  async markRead(ids: readonly string[]): Promise<void> {
    await this.http.post(this.endpoint, { ids }, { headers: this.headers });
  }

  async markAllRead(): Promise<void> {
    await this.http.post(this.endpoint, { all: true }, { headers: this.headers });
  }

  private get headers(): Record<string, string> {
    return {
      apikey: this.env.supabasePublishableKey,
      Authorization: `Bearer ${this.auth.token || ''}`,
      'Content-Type': 'application/json',
    };
  }

  private mapRow(row: NotificationRow): AppNotification {
    const data = row['data'];
    return {
      id: String(row['id'] || ''),
      kind: String(row['kind'] || ''),
      requestId: String(row['request_id'] || ''),
      title: String(row['title'] || ''),
      body: String(row['body'] || ''),
      data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
      createdAt: String(row['created_at'] || ''),
    };
  }
}
