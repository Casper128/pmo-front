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

/** Respuesta de la solicitud: `duplicated` si ya existía una solicitud pendiente para el reporte. */
export interface DeleteRequestResult {
  duplicated: boolean;
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
  abstract requestDelete(body: DeleteRequestBody): Promise<DeleteRequestResult>;
  abstract technicalDelete(body: TechnicalDeleteBody): Promise<void>;
  abstract download(filter: ReportDownloadFilter): Promise<ReportDownloadResponse>;
}
