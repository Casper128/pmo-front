import { AdvancedFieldKey } from '@domain/configuration/app-parameters.model';

export type AdvancedTemplateFieldKey =
  | AdvancedFieldKey
  | 'ricef'
  | 'proyecto'
  | 'funcional'
  | 'unity'
  | 'fechaEstimada'
  | 'fechaReal';

export type AdvancedTemplateValues = Partial<Record<AdvancedTemplateFieldKey, string>>;

export interface ManagementDemandOption {
  id: string;
  name: string;
  requestValue?: string;
  client?: string;
  project?: string;
  module?: string;
  raw?: unknown;
}

export interface ManagementAdvancedTemplate {
  gestionId: string;
  gestionName: string;
  client?: string;
  project?: string;
  values: AdvancedTemplateValues;
  completed?: boolean;
  updatedAt?: string;
}

export const ADVANCED_TEMPLATE_FIELDS: readonly {
  key: AdvancedTemplateFieldKey;
  label: string;
  type: 'select' | 'text' | 'date';
  required?: boolean;
}[] = [
  { key: 'ricef', label: 'RICEF', type: 'text' },
  { key: 'proyecto', label: 'Proyecto', type: 'text' },
  { key: 'funcional', label: 'Funcional', type: 'text', required: true },
  { key: 'tipoActividad', label: 'Tipo actividad', type: 'select', required: true },
  { key: 'causa', label: 'Causa', type: 'select', required: true },
  { key: 'complejidad', label: 'Complejidad', type: 'select', required: true },
  { key: 'impacto', label: 'Impacto', type: 'select', required: true },
  { key: 'equipo', label: 'Equipo', type: 'select', required: true },
  { key: 'modoActuacion', label: 'Modo actuación', type: 'select', required: true },
  { key: 'lenguaje', label: 'Lenguaje', type: 'select', required: true },
  { key: 'prefijo', label: 'Prefijo', type: 'select', required: true },
  { key: 'objetoRicef', label: 'RICEF object', type: 'select', required: true },
  { key: 'unity', label: 'Módulo SAP', type: 'text' },
  { key: 'fechaEstimada', label: 'Fecha estimada pruebas', type: 'date' },
  { key: 'fechaReal', label: 'Fecha real pruebas', type: 'date' },
  { key: 'categoria', label: 'Categoría', type: 'select', required: true },
];

export const REQUIRED_ADVANCED_TEMPLATE_FIELDS = ADVANCED_TEMPLATE_FIELDS.filter(
  (field) => field.required,
);

export function isMissingAdvancedTemplateValue(value: unknown): boolean {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return ['', 'n/a', 'na', 'n.a', 'n.a.', 'sin valor'].includes(normalized);
}
