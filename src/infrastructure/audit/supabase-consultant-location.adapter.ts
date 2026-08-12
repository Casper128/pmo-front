import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthGateway } from '@application/auth/auth.gateway';
import { ConsultantLocationGateway } from '@application/audit/consultant-location.gateway';
import {
  ConsultantLocation,
  ConsultantLocationCollection,
  ConsultantLocationEvent,
  ConsultantLocationFilter,
  LocationVerificationStatus,
} from '@domain/audit/consultant-location.model';
import { environment } from '@env/environment';

interface LocationApiResponse {
  consultants?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
}

@Injectable()
export class SupabaseConsultantLocationAdapter extends ConsultantLocationGateway {
  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthGateway,
  ) {
    super();
  }

  list(filter: ConsultantLocationFilter): Observable<ConsultantLocationCollection> {
    const headers = new HttpHeaders({
      apikey: environment.supabasePublishableKey,
      Authorization: `Bearer ${this.auth.token || ''}`,
    });
    const params = new HttpParams().set('from', filter.dateFrom).set('to', filter.dateTo);
    return this.http
      .get<LocationApiResponse>(`${environment.supabaseUrl}/functions/v1/pmo-location-admin`, {
        headers,
        params,
      })
      .pipe(
        map((response) => ({
          consultants: (response.consultants || []).map((row) => this.mapConsultant(row)),
          events: (response.events || []).map((row) => this.mapEvent(row)),
        })),
      );
  }

  private mapConsultant(row: Record<string, unknown>): ConsultantLocation {
    return {
      userKey: this.text(row['user_key']),
      email: this.text(row['email']),
      fullName: this.text(row['full_name']) || this.text(row['email']),
      username: this.text(row['username']),
      homeLatitude: this.number(row['home_latitude']),
      homeLongitude: this.number(row['home_longitude']),
      homeRadiusM: this.number(row['home_radius_m']) || 500,
      lastLatitude: this.number(row['last_latitude']),
      lastLongitude: this.number(row['last_longitude']),
      lastAccuracyM: this.number(row['last_location_accuracy_m']),
      lastLocationStatus: this.text(row['last_location_status']),
      lastDistanceToHomeM: this.number(row['last_distance_to_home_m']),
      lastWithinHomeRadius:
        typeof row['last_within_home_radius'] === 'boolean'
          ? (row['last_within_home_radius'] as boolean)
          : null,
      lastVerificationStatus:
        (this.nullableText(row['last_verification_status']) as LocationVerificationStatus | null),
      lastLocationSource:
        (this.nullableText(row['last_location_source']) as 'login' | 'time_report' | null),
      lastLocationAt: this.nullableText(row['last_location_at']),
    };
  }

  private mapEvent(row: Record<string, unknown>): ConsultantLocationEvent {
    return {
      id: this.number(row['id']) || 0,
      userKey: this.text(row['user_key']),
      reportReference: this.text(row['report_reference']),
      customer: this.text(row['customer']),
      reportDate: this.nullableText(row['report_date']),
      successful: row['report_success'] === true,
      occurredAt: this.text(row['occurred_at']),
      latitude: this.number(row['latitude']),
      longitude: this.number(row['longitude']),
      accuracyM: this.number(row['location_accuracy_m']),
      locationStatus: this.text(row['location_status']),
      distanceToHomeM: this.number(row['distance_to_home_m']),
      withinHomeRadius:
        typeof row['within_home_radius'] === 'boolean'
          ? (row['within_home_radius'] as boolean)
          : null,
      verificationStatus: this.text(row['verification_status']) as LocationVerificationStatus,
    };
  }

  private text(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  private nullableText(value: unknown): string | null {
    const text = this.text(value);
    return text || null;
  }

  private number(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
