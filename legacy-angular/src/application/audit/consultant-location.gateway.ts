import { Observable } from 'rxjs';
import {
  ConsultantLocationCollection,
  ConsultantLocationFilter,
} from '@domain/audit/consultant-location.model';

export abstract class ConsultantLocationGateway {
  abstract list(filter: ConsultantLocationFilter): Observable<ConsultantLocationCollection>;
}
