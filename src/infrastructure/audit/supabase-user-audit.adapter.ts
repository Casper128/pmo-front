import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { AuthGateway } from '@application/auth/auth.gateway';
import { ReportAuditContext, UserAuditGateway } from '@application/audit/audit.gateways';
import { WorkLocation } from '@domain/audit/work-location.model';

@Injectable()
export class SupabaseUserAuditAdapter implements UserAuditGateway {
  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthGateway,
  ) {}

  recordLogin(location: WorkLocation): Observable<void> {
    return this.post(location);
  }

  recordTimeReport(
    location: WorkLocation,
    report: ReportAuditContext,
    successful: boolean,
  ): Observable<void> {
    return this.post({ ...location, eventType: 'time_report', successful, report });
  }

  private post(body: object): Observable<void> {
    const token = this.auth.token;
    const headers = new HttpHeaders({
      apikey: environment.supabasePublishableKey,
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
    });
    return this.http
      .post<unknown>(`${environment.supabaseUrl}/functions/v1/pmo-user-audit`, body, { headers })
      .pipe(map(() => undefined));
  }
}
