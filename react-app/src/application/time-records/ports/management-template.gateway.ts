import type {
  ManagementAdvancedTemplate,
  ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';

export abstract class ManagementTemplateGateway {
  abstract list(): Promise<ManagementAdvancedTemplate[]>;
  abstract get(gestionId: string): Promise<ManagementAdvancedTemplate | null>;
  abstract save(template: ManagementAdvancedTemplate): Promise<ManagementAdvancedTemplate>;
  abstract remove(gestionId: string): Promise<void>;
  abstract registerKnownManagement(option: ManagementDemandOption): void;
  abstract knownManagement(gestionId: string): ManagementDemandOption | null;
}
