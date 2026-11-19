import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { normalizeText } from '@presentation/shared/format';

export type TemplateStatusFilter = 'all' | 'complete' | 'incomplete';
export type TemplateSort = 'recent' | 'name' | 'id';

export const TEMPLATE_SORT_OPTIONS: readonly { value: TemplateSort; label: string }[] = [
  { value: 'recent', label: 'Actualizadas recientemente' },
  { value: 'name', label: 'Nombre de gestión' },
  { value: 'id', label: 'ID de gestión' },
];

export interface TemplateFilters {
  readonly search: string;
  readonly client: string;
  readonly status: TemplateStatusFilter;
  readonly sort: TemplateSort;
}

export const isComplete = (template: ManagementAdvancedTemplate) => template.completed === true;

const searchText = (template: ManagementAdvancedTemplate) =>
  normalizeText([template.gestionName, template.gestionId, template.client, template.project, ...Object.values(template.values)].join(' '));

/** Clientes distintos de las plantillas, ordenados en español (opciones del filtro de cliente). */
export function templateClients(templates: readonly ManagementAdvancedTemplate[]): string[] {
  return Array.from(new Set(templates.map((template) => String(template.client || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
}

/** Filtra por estado, cliente y texto (sin tildes) y ordena (`filteredTemplates` de Angular). */
export function filterTemplates(templates: readonly ManagementAdvancedTemplate[], { search, client, status, sort }: TemplateFilters): ManagementAdvancedTemplate[] {
  const term = normalizeText(search);
  return templates
    .filter((template) => {
      if (status === 'complete' && !isComplete(template)) return false;
      if (status === 'incomplete' && isComplete(template)) return false;
      if (client && normalizeText(template.client) !== normalizeText(client)) return false;
      return !term || searchText(template).includes(term);
    })
    .sort((a, b) => {
      if (sort === 'name') return a.gestionName.localeCompare(b.gestionName, 'es');
      if (sort === 'id') return a.gestionId.localeCompare(b.gestionId, 'es');
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
}
