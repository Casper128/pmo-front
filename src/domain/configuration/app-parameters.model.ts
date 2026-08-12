export type AdvancedFieldKey =
  | 'tipoActividad'
  | 'causa'
  | 'complejidad'
  | 'impacto'
  | 'equipo'
  | 'modoActuacion'
  | 'lenguaje'
  | 'tipoHora'
  | 'prefijo'
  | 'objetoRicef'
  | 'categoria';

export interface ParameterOption {
  value: string;
  label: string;
  active: boolean;
  sortOrder: number;
}

export interface AdvancedFieldConfiguration {
  key: AdvancedFieldKey;
  label: string;
  defaultValue: string;
  options: ParameterOption[];
}

export interface WorkSettings {
  mondayThursdayHours: number;
  fridayHours: number;
  maxDailyLaborHours: number;
  maxHoursPerRecord: number;
}
