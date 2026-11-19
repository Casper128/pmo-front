import { Observable } from 'rxjs';
import {
  ManagementReport,
  ReportDownloadFilter,
  ReportDownloadResponse,
} from '@domain/time-records/models/management-report.model';

export interface DeleteRequestBody {
  identifier: string;
  auditorEmail: string;
  report: Partial<ManagementReport>;
}

export interface TechnicalDeleteBody {
  identifier: string;
  technicalKey: string;
  requesterEmail: string;
}

export abstract class TimeManagementGateway {
  abstract list(consultantId: string | number | null): Observable<ManagementReport[]>;
  abstract update(identifier: string, body: Record<string, unknown>): Observable<void>;
  abstract delete(identifier: string): Observable<void>;
  abstract requestDelete(body: DeleteRequestBody): Observable<void>;
  abstract technicalDelete(body: TechnicalDeleteBody): Observable<void>;
  abstract download(filter: ReportDownloadFilter): Observable<ReportDownloadResponse>;
}
