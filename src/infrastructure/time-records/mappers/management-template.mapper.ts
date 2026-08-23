import { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';

export interface TemplatePayload {
  templates?: ManagementAdvancedTemplate[];
  template?: ManagementAdvancedTemplate | null;
}

export class ManagementTemplateMapper {
  many(value: ManagementAdvancedTemplate[]): ManagementAdvancedTemplate[] {
    return value
      .map((item) => this.one(item))
      .filter((item): item is ManagementAdvancedTemplate => !!item);
  }

  one(value: ManagementAdvancedTemplate | null): ManagementAdvancedTemplate | null {
    if (!value?.gestionId) return null;
    const values = Object.fromEntries(
      Object.entries(value.values || {})
        .map(([key, fieldValue]) => [key, String(fieldValue || '')]),
    );
    return {
      gestionId: String(value.gestionId),
      gestionName: String(value.gestionName || value.gestionId),
      client: value.client ? String(value.client) : undefined,
      project: value.project ? String(value.project) : undefined,
      values,
      completed: value.completed === true,
      updatedAt: value.updatedAt,
    };
  }
}
