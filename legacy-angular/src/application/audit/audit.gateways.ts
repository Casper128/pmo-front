import { Observable } from 'rxjs';
import { WorkLocation, LocationRequest } from '@domain/audit/work-location.model';

export interface ReportAuditContext {
  reference: string;
  customer: string;
  date: string;
}

export abstract class LocationGateway {
  abstract capture(request: LocationRequest): Promise<WorkLocation>;
}

export abstract class UserAuditGateway {
  abstract recordLogin(location: WorkLocation): Observable<void>;
  abstract recordTimeReport(
    location: WorkLocation,
    report: ReportAuditContext,
    successful: boolean,
  ): Observable<void>;
}
