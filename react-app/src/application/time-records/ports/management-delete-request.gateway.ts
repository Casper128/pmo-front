import type {
  ManagementDeleteRequest,
  ManagementDeleteRequestStatus,
} from '@domain/time-records/models/management-delete-request.model';

export abstract class ManagementDeleteRequestGateway {
  abstract list(): Promise<ManagementDeleteRequest[]>;
  abstract mark(
    id: string,
    status: Extract<ManagementDeleteRequestStatus, 'approved' | 'rejected'>,
  ): Promise<ManagementDeleteRequest>;
}
