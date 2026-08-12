import {
  AdvancedFieldConfiguration,
  AdvancedFieldKey,
  ParameterOption,
  WorkSettings,
} from '@domain/configuration/app-parameters.model';

export abstract class AppParametersFacade {
  abstract readonly fields: () => AdvancedFieldConfiguration[];
  abstract readonly workSettings: () => WorkSettings;
  abstract readonly loading: () => boolean;
  abstract readonly saving: () => boolean;
  abstract readonly error: () => string;
  abstract readonly source: () => 'supabase' | 'local';
  abstract readonly configured: () => boolean;
  abstract readonly canManage: () => boolean;
  abstract load(): Promise<void>;
  abstract optionsFor(key: AdvancedFieldKey): ParameterOption[];
  abstract valuesFor(key: AdvancedFieldKey): string[];
  abstract defaultFor(key: AdvancedFieldKey): string;
  abstract defaults(): Record<AdvancedFieldKey, string>;
  abstract save(fields: AdvancedFieldConfiguration[], workSettings: WorkSettings): Promise<void>;
  abstract resetLocal(): void;
}
