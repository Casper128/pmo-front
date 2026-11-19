import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';

export abstract class ManagementDeleteRequestGateway {
  /** Solicitudes pendientes de revisión (auditoría). */
  abstract list(): Promise<ManagementDeleteRequest[]>;
  /** Solicitudes del usuario autenticado (`?scope=mine`), de todos los estados. */
  abstract listMine(): Promise<ManagementDeleteRequest[]>;
  /** Aprueba y elimina el reporte en un solo paso en el servidor (`deleteReport: true`). */
  abstract approve(id: string): Promise<ManagementDeleteRequest>;
  abstract reject(id: string, reviewNote?: string): Promise<ManagementDeleteRequest>;
}
