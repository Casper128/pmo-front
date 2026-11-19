import type {
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
  abstract list(consultantId: string | number | null): Promise<ManagementReport[]>;
  abstract update(identifier: string, body: Record<string, unknown>): Promise<void>;
  abstract delete(identifier: string): Promise<void>;
  abstract requestDelete(body: DeleteRequestBody): Promise<void>;
  abstract technicalDelete(body: TechnicalDeleteBody): Promise<void>;
  abstract download(filter: ReportDownloadFilter): Promise<ReportDownloadResponse>;
}
