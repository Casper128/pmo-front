import { Observable } from 'rxjs';
import {
  ManagementReport,
  ReportDownloadFilter,
  ReportDownloadResponse,
} from '@domain/time-records/models/management-report.model';

export abstract class TimeManagementGateway {
  abstract list(consultantId: string | number | null): Observable<ManagementReport[]>;
  abstract update(identifier: string, body: Record<string, unknown>): Observable<void>;
  abstract download(filter: ReportDownloadFilter): Observable<ReportDownloadResponse>;
}
