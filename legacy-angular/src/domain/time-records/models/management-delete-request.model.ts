import { ManagementReport } from './management-report.model';

export type ManagementDeleteRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ManagementDeleteRequest {
  id: string;
  identifier: string;
  requesterKey: string;
  requesterEmail: string;
  auditorEmail: string;
  report: Partial<ManagementReport>;
  status: ManagementDeleteRequestStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}
