import { Observable } from 'rxjs';
import {
  ManagementAdvancedTemplate,
  ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';

export abstract class ManagementTemplateGateway {
  abstract list(): Observable<ManagementAdvancedTemplate[]>;
  abstract get(gestionId: string): Observable<ManagementAdvancedTemplate | null>;
  abstract save(template: ManagementAdvancedTemplate): Observable<ManagementAdvancedTemplate>;
  abstract remove(gestionId: string): Observable<void>;
  abstract registerKnownManagement(option: ManagementDemandOption): void;
  abstract knownManagement(gestionId: string): ManagementDemandOption | null;
}
