import { describe, expect, it, vi } from 'vitest';
import type { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import type { WorkLocation } from '@domain/audit/work-location.model';
import type {
  ManagementAdvancedTemplate,
  AdvancedTemplateValues,
} from '@domain/time-records/models/management-template.model';
import type { TimeRecordApiBody } from '@domain/time-records/models/time-record-api.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import type { TimeRecordApiBodyBuilder } from '@domain/time-records/services/time-record-api-body.builder';
import type { ManagementTemplateGateway } from '../ports/management-template.gateway';
import { RegisterTimeRecordUseCase } from './register-time-record.use-case';

const record: TimeRecord = {
  fecha: '2026-09-09',
  horaIni: '19:30',
  horaFin: '23:59',
  horas: '4.48',
  desc: 'Pruebas',
  observacion: '',
  cliente: 'Cliente A',
  proyecto: 'Proyecto A',
  solicitud: 'Gestión A',
  gestionId: 'G-1',
  tipoHora: 'Fábrica',
};

const completeValues: AdvancedTemplateValues = {
  funcional: 'Ana',
  tipoActividad: 'Desarrollo',
  causa: 'Evolutivo',
  complejidad: 'Media',
  impacto: 'Bajo',
  equipo: 'ABAP',
  modoActuacion: 'Remoto',
  lenguaje: 'ABAP',
  prefijo: 'Z',
  objetoRicef: 'Report',
  categoria: 'Proyecto',
};

const template = (overrides: Partial<ManagementAdvancedTemplate> = {}): ManagementAdvancedTemplate => ({
  gestionId: 'G-1',
  gestionName: 'Gestión A',
  values: completeValues,
  completed: true,
  ...overrides,
});

const body = { solicitud: 'Gestión A', cliente: 'Cliente A', HoraInicio: '2026-09-09T19:30:00' } as TimeRecordApiBody;
const location: WorkLocation = { latitude: 4.6, longitude: -74.1, accuracy: 10, locationStatus: 'granted' };

function setup(found: ManagementAdvancedTemplate | null = template()) {
  const repository = { register: vi.fn(async () => ({ status: 200, identificador: 'RH-1' })) };
  const locationGateway = { capture: vi.fn(async () => location) };
  const audit = { recordTimeReport: vi.fn(async () => undefined), recordLogin: vi.fn() };
  const templates = { get: vi.fn(async () => found) };
  const bodyBuilder = { build: vi.fn((_input: unknown) => body) };
  const useCase = new RegisterTimeRecordUseCase(
    repository as unknown as TimeRecordRepository,
    locationGateway as unknown as LocationGateway,
    audit as unknown as UserAuditGateway,
    templates as unknown as ManagementTemplateGateway,
    bodyBuilder as unknown as TimeRecordApiBodyBuilder,
  );
  return { repository, locationGateway, audit, templates, bodyBuilder, useCase };
}

describe('RegisterTimeRecordUseCase', () => {
  it('registra, captura la ubicación con las opciones exactas y audita el éxito', async () => {
    const { repository, locationGateway, audit, templates, bodyBuilder, useCase } = setup();

    await expect(useCase.execute(record)).resolves.toEqual({ status: 200, identificador: 'RH-1' });

    expect(templates.get).toHaveBeenCalledWith('G-1');
    expect(bodyBuilder.build).toHaveBeenCalledWith(expect.objectContaining({ ...record, ...completeValues }));
    expect(locationGateway.capture).toHaveBeenCalledWith({
      highAccuracy: true,
      maximumAgeMs: 0,
      timeoutMs: 15000,
    });
    expect(repository.register).toHaveBeenCalledWith(body);
    expect(audit.recordTimeReport).toHaveBeenCalledWith(
      location,
      { reference: 'Gestión A', customer: 'Cliente A', date: '2026-09-09' },
      true,
    );
  });

  it('busca la plantilla por solicitud si no hay gestionId', async () => {
    const { templates, useCase } = setup();
    await useCase.execute({ ...record, gestionId: '' });
    expect(templates.get).toHaveBeenCalledWith('Gestión A');
  });

  it('aplica la plantilla sin pisar tipoHora, valores vacíos, funcional ni ricef ya informados', async () => {
    const { bodyBuilder, useCase } = setup(
      template({ values: { ...completeValues, tipoHora: 'Laboral', ricef: 'R-T', unity: '  ', proyecto: 'P-T' } }),
    );

    await useCase.execute({ ...record, funcional: 'Propio', ricef: 'R-propio' });

    const prepared = bodyBuilder.build.mock.calls[0]?.[0] as Record<string, string>;
    expect(prepared).toMatchObject({
      tipoHora: 'Fábrica',
      funcional: 'Propio',
      ricef: 'R-propio',
      proyecto: 'P-T',
      categoria: 'Proyecto',
    });
    expect(prepared['unity']).toBeUndefined();
  });

  it.each([
    [null, 'La gestión "Gestión A" no tiene plantilla de campos avanzados configurada.'],
    [template({ completed: false }), 'La plantilla de "Gestión A" todavía está pendiente.'],
    [
      template({ values: { ...completeValues, causa: 'N/A', impacto: '', categoria: 'sin valor' } }),
      'La plantilla de "Gestión A" está incompleta. Faltan: Causa, Impacto, Categoría.',
    ],
  ])('rechaza plantillas no válidas con el mensaje exacto y sin registrar ni auditar (%#)', async (found, message) => {
    const { repository, locationGateway, audit, useCase } = setup(found);

    await expect(useCase.execute(record)).rejects.toThrow(message);
    expect(locationGateway.capture).not.toHaveBeenCalled();
    expect(repository.register).not.toHaveBeenCalled();
    expect(audit.recordTimeReport).not.toHaveBeenCalled();
  });

  it('si el registro falla audita false y relanza el mismo error', async () => {
    const { repository, audit, useCase } = setup();
    const error = { status: 500, error: { message: 'boom' } };
    repository.register.mockRejectedValueOnce(error);

    await expect(useCase.execute(record)).rejects.toBe(error);
    expect(audit.recordTimeReport).toHaveBeenCalledWith(location, expect.any(Object), false);
  });

  it('un fallo de auditoría se ignora tanto en éxito como en error', async () => {
    const success = setup();
    success.audit.recordTimeReport.mockRejectedValueOnce(new Error('audit down'));
    await expect(success.useCase.execute(record)).resolves.toMatchObject({ status: 200 });

    const failure = setup();
    const error = new Error('register down');
    failure.repository.register.mockRejectedValueOnce(error);
    failure.audit.recordTimeReport.mockRejectedValueOnce(new Error('audit down'));
    await expect(failure.useCase.execute(record)).rejects.toBe(error);
  });
});
