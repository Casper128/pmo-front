import { Observable } from 'rxjs';
import {
  ManagementDeleteRequest,
  ManagementDeleteRequestStatus,
} from '@domain/time-records/models/management-delete-request.model';

export abstract class ManagementDeleteRequestGateway {
  abstract list(): Observable<ManagementDeleteRequest[]>;
  abstract mark(
    id: string,
    status: Extract<ManagementDeleteRequestStatus, 'approved' | 'rejected'>,
  ): Observable<ManagementDeleteRequest>;
}
