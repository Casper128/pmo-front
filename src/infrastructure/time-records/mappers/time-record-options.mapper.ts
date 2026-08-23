import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';

type CollectionResponse =
  | unknown[]
  | { clientes?: unknown[]; proyectos?: unknown[]; solicitudes?: unknown[]; data?: unknown[] };

export class TimeRecordOptionsMapper {
  collection(value: CollectionResponse, key: 'clientes' | 'proyectos' | 'solicitudes'): unknown[] {
    return Array.isArray(value) ? value : value[key] || value.data || [];
  }

  optionValue(value: unknown, keys: string[]): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    const candidate = keys
      .map((key) => record[key])
      .find((item) => typeof item === 'string' || typeof item === 'number');
    return candidate === undefined ? '' : String(candidate);
  }

  demandOption(value: unknown): ManagementDemandOption {
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value);
      return { id: text, name: text, requestValue: text, raw: value };
    }
    if (!value || typeof value !== 'object') return { id: '', name: '' };
    const record = value as Record<string, unknown>;
    const requestValue = this.optionValue(record, ['solicitud', 'gestion', 'numero', 'id']);
    const id = this.firstNestedValue(record, [
      'id',
      'idGestion',
      'idSolicitud',
      'gestionId',
      'solicitudId',
      'id_solicitud',
      'id_gestion',
      'codigo',
    ]);
    const name = this.firstNestedValue(record, [
      'nombreGestion',
      'solicitud',
      'gestion',
      'numero',
      'nombre',
      'descripcion',
      'identificador',
    ]);
    return {
      id: id || requestValue || name,
      name: name || requestValue || id,
      requestValue: requestValue || id || name,
      client: this.firstNestedValue(record, ['cliente', 'nombreCliente']),
      project: this.firstNestedValue(record, ['proyecto', 'nombreProyecto']),
      module: this.firstNestedValue(record, ['modulo', 'module', 'unidad', 'unity']),
      raw: value,
    };
  }

  private firstNestedValue(value: unknown, keys: string[]): string {
    if (!value || typeof value !== 'object') return '';
    const object = value as Record<string, unknown>;
    for (const key of keys) {
      const current = object[key];
      if (typeof current === 'string' || typeof current === 'number') return String(current);
    }
    for (const current of Object.values(object)) {
      const nested = this.firstNestedValue(current, keys);
      if (nested) return nested;
    }
    return '';
  }
}
