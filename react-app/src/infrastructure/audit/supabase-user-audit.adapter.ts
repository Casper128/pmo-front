import type { ReportAuditContext, UserAuditGateway } from '@application/audit/audit.gateways';
import type { AuthGateway } from '@application/auth/auth.gateway';
import type { WorkLocation } from '@domain/audit/work-location.model';
import type { Environment } from '@env/environment';
import type { HttpClient } from '../http/http-client';

/** Auditoría de login y de reporte en la función Supabase `pmo-user-audit`. */
export class SupabaseUserAuditAdapter implements UserAuditGateway {
  private readonly http: HttpClient;
  private readonly auth: AuthGateway;
  private readonly env: Environment;

  constructor(http: HttpClient, auth: AuthGateway, env: Environment) {
    this.http = http;
    this.auth = auth;
    this.env = env;
  }

  recordLogin(location: WorkLocation): Promise<void> {
    return this.post(location);
  }

  recordTimeReport(location: WorkLocation, report: ReportAuditContext, successful: boolean): Promise<void> {
    return this.post({ ...location, eventType: 'time_report', successful, report });
  }

  private async post(body: object): Promise<void> {
    const token = this.auth.token;
    await this.http.post<unknown>(`${this.env.supabaseUrl}/functions/v1/pmo-user-audit`, body, {
      headers: {
        apikey: this.env.supabasePublishableKey,
        Authorization: `Bearer ${token || ''}`,
        'Content-Type': 'application/json',
      },
    });
  }
}
