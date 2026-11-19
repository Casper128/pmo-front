import type {
  ManagementDeleteRequest,
  ManagementDeleteRequestStatus,
} from '@domain/time-records/models/management-delete-request.model';

export abstract class ManagementDeleteRequestGateway {
  abstract list(): Promise<ManagementDeleteRequest[]>;
  /** Solicitudes del usuario autenticado (`?scope=mine`), de todos los estados. */
  abstract listMine(): Promise<ManagementDeleteRequest[]>;
  abstract mark(
    id: string,
    status: Extract<ManagementDeleteRequestStatus, 'approved' | 'rejected'>,
  ): Promise<ManagementDeleteRequest>;
}
