import type {
  ConsultantLocationCollection,
  ConsultantLocationFilter,
} from '@domain/audit/consultant-location.model';

export abstract class ConsultantLocationGateway {
  abstract list(filter: ConsultantLocationFilter): Promise<ConsultantLocationCollection>;
}
