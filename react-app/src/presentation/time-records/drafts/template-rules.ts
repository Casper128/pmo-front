import type { AdvancedFieldKey } from '@domain/configuration/app-parameters.model';
import type { TimeRecordApiBody } from '@domain/time-records/models/time-record-api.model';
import {
  REQUIRED_ADVANCED_TEMPLATE_FIELDS,
  isMissingAdvancedTemplateValue,
  type AdvancedTemplateValues,
  type ManagementAdvancedTemplate,
  type ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';
import { normalizeText } from '@presentation/shared/format';

export type TemplateMap = ReadonlyMap<string, ManagementAdvancedTemplate>;

/** `uniqueText` de Angular: sin vacíos ni repetidos, ordenado en español. */
function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

const normalizeManagementName = (value: unknown): string => normalizeText(value).replace(/\s+/g, ' ');

function managementTemplateKeys(template: ManagementAdvancedTemplate): string[] {
  return uniqueText([template.gestionId, template.gestionName, normalizeManagementName(template.gestionName)]);
}

function managementOptionKeys(option: ManagementDemandOption): string[] {
  return uniqueText([
    option.id,
    option.name,
    option.requestValue || '',
    normalizeManagementName(option.name),
    normalizeManagementName(option.id),
    normalizeManagementName(option.requestValue),
  ]);
}

/** `mergeManagementTemplate` de Angular: indexa la plantilla por id, nombre y nombre normalizado. */
export function mergeManagementTemplate(map: TemplateMap, template: ManagementAdvancedTemplate): TemplateMap {
  const next = new Map(map);
  managementTemplateKeys(template).forEach((key) => next.set(key, template));
  return next;
}

export function buildManagementTemplateMap(templates: readonly ManagementAdvancedTemplate[]): TemplateMap {
  return templates.reduce<TemplateMap>(mergeManagementTemplate, new Map());
}

/** `templateForManagement` de Angular. */
export function templateForManagement(option: ManagementDemandOption, templates: TemplateMap): ManagementAdvancedTemplate | null {
  return (
    managementOptionKeys(option)
      .map((key) => templates.get(key))
      .find((template): template is ManagementAdvancedTemplate => !!template) || null
  );
}

/** Etiquetas de los campos obligatorios que faltan (`missingRequiredTemplateFields` de Angular). */
export function missingRequiredTemplateFields(template: ManagementAdvancedTemplate): string[] {
  return REQUIRED_ADVANCED_TEMPLATE_FIELDS.filter((field) =>
    isMissingAdvancedTemplateValue(template.values[field.key]),
  ).map((field) => field.label);
}

/** Valores iniciales de una plantilla nueva (`defaultTemplateValues` de Angular). */
export function defaultTemplateValues(
  option: ManagementDemandOption | undefined,
  defaultProyecto: string,
  defaultFor: (key: AdvancedFieldKey) => string,
): AdvancedTemplateValues {
  return {
    proyecto: option?.project || defaultProyecto,
    funcional: '',
    tipoActividad: defaultFor('tipoActividad'),
    causa: defaultFor('causa'),
    complejidad: defaultFor('complejidad'),
    impacto: defaultFor('impacto'),
    equipo: defaultFor('equipo'),
    modoActuacion: defaultFor('modoActuacion'),
    lenguaje: defaultFor('lenguaje'),
    prefijo: defaultFor('prefijo'),
    objetoRicef: defaultFor('objetoRicef'),
    categoria: defaultFor('categoria'),
  };
}

/** `withManagementControlData` de Angular: completa cliente/proyecto de la plantilla desde la gestión. */
export function withManagementControlData(
  template: ManagementAdvancedTemplate,
  option: ManagementDemandOption,
): ManagementAdvancedTemplate {
  const changed = (!!option.client && !template.client) || (!!option.project && !template.project);
  return changed
    ? {
        ...template,
        client: template.client || option.client,
        project: template.project || option.project,
        values: { ...template.values },
      }
    : template;
}

/** Reemplaza (por `gestionId`) o agrega una plantilla en la lista cacheada. */
export function upsertTemplate(
  templates: readonly ManagementAdvancedTemplate[] | undefined,
  saved: ManagementAdvancedTemplate,
): ManagementAdvancedTemplate[] {
  const list = templates ?? [];
  return list.some((item) => item.gestionId === saved.gestionId)
    ? list.map((item) => (item.gestionId === saved.gestionId ? saved : item))
    : [...list, saved];
}

/** Campos avanzados que se enviarán (vista de solo lectura del modal de edición). */
export function payloadFields(payload: TimeRecordApiBody): { label: string; value: string }[] {
  return [
    { label: 'RICEF', value: payload.ricef },
    { label: 'Proyecto', value: payload.proyecto },
    { label: 'Funcional', value: payload.funcional },
    { label: 'Tipo actividad', value: payload.tipoActividad },
    { label: 'Causa', value: payload.causa },
    { label: 'Complejidad', value: payload.complejidad },
    { label: 'Impacto', value: payload.impacto },
    { label: 'Equipo', value: payload.equipo },
    { label: 'Módulo SAP', value: payload.unity },
    { label: 'Modo actuación', value: payload.modoActuacion },
    { label: 'Lenguaje', value: payload.lenguaje },
    { label: 'Prefijo', value: payload.prefijo },
    { label: 'RICEF object', value: payload.objetoRicef },
    { label: 'Categoría', value: payload.categoria },
    { label: 'Fecha estimada pruebas', value: payload.fechaEstimadaPruebas || '' },
    { label: 'Fecha real pruebas', value: payload.fechaEstimadaRealPruebas || '' },
  ].map((field) => ({ ...field, value: field.value || 'Sin valor' }));
}
