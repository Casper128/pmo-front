import { vi } from 'vitest';
import type { ManagementTemplateGateway } from '@application/time-records/ports/management-template.gateway';
import type {
  ManagementAdvancedTemplate,
  ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import type { Container } from '@presentation/providers/container-context';
import { FakeAppParameters, testParameterFields, type FakeParametersState } from './fake-app-parameters';
import { FakeAuthGateway, testUser } from './fake-auth';
import { createTestContainer } from './test-container';

/** Catálogo ficticio: cliente → proyecto y gestiones (sin `client`/`project`, como llega del backend). */
export const testCatalog: Record<string, { project: string; options: ManagementDemandOption[] }> = {
  'Cliente Alfa': {
    project: 'Proyecto A',
    options: [
      { id: 'G-1', name: 'Gestión Uno' },
      { id: 'G-2', name: 'Gestión Dos' },
    ],
  },
  'Cliente Beta': { project: 'Proyecto B', options: [{ id: 'G-3', name: 'Gestión Tres' }] },
};

export function createFakeRepository() {
  return {
    register: vi.fn(),
    getClientes: vi.fn(async () => Object.keys(testCatalog)),
    getProyectos: vi.fn(async (cliente: string) => (testCatalog[cliente] ? [testCatalog[cliente].project] : [])),
    getSolicitudes: vi.fn(async () => []),
    getSolicitudOptions: vi.fn(async (cliente: string) => testCatalog[cliente]?.options ?? []),
  } satisfies TimeRecordRepository;
}

export function createFakeTemplates(configured: ManagementAdvancedTemplate[] = []) {
  const known: ManagementAdvancedTemplate[] = [...configured];
  return {
    list: vi.fn(async () => [...known]),
    get: vi.fn(async (gestionId: string) => known.find((item) => item.gestionId === gestionId) ?? null),
    save: vi.fn(async (template: ManagementAdvancedTemplate) => {
      known.push(template);
      return template;
    }),
    remove: vi.fn(async () => undefined),
    registerKnownManagement: vi.fn(),
    knownManagement: vi.fn(() => null),
  } satisfies ManagementTemplateGateway;
}

/** Plantilla completa de una gestión (todos los obligatorios con valor). */
export function completeTemplate(
  gestionId: string,
  gestionName: string,
  client = 'Cliente Alfa',
  project = 'Proyecto A',
): ManagementAdvancedTemplate {
  return {
    gestionId,
    gestionName,
    client,
    project,
    completed: true,
    values: {
      funcional: 'Funcional de prueba',
      tipoActividad: 'Desarrollo',
      causa: 'Error',
      complejidad: 'Baja',
      impacto: 'Bajo',
      equipo: 'Equipo A',
      modoActuacion: 'Correctivo',
      lenguaje: 'ABAP',
      prefijo: 'Z',
      objetoRicef: 'Reporte',
      categoria: 'Mantenimiento',
    },
  };
}

export interface DraftsContainerOptions {
  readonly parameters?: Partial<FakeParametersState>;
  readonly repository?: ReturnType<typeof createFakeRepository>;
  readonly templates?: ReturnType<typeof createFakeTemplates>;
  /** Sustituye puertos concretos del contenedor (p. ej. `sendAllRecords`, `sendLogs`, `timeManagement`). */
  readonly overrides?: Partial<Container>;
}

/** Contenedor de pruebas con sesión iniciada, parámetros con opciones y repositorio/plantillas ficticios. */
export function createDraftsContainer({ parameters = {}, repository, templates, overrides = {} }: DraftsContainerOptions = {}) {
  const auth = new FakeAuthGateway({ user: testUser });
  const fakeParameters = new FakeAppParameters({ fields: testParameterFields(), ...parameters }, auth);
  const fakeRepository = repository ?? createFakeRepository();
  // Por defecto todas las gestiones del catálogo ya tienen plantilla: no se abre el diálogo de configuración.
  const fakeTemplates =
    templates ??
    createFakeTemplates(
      Object.entries(testCatalog).flatMap(([client, { project, options }]) =>
        options.map((option) => completeTemplate(option.id, option.name, client, project)),
      ),
    );
  const container: Container = createTestContainer({
    auth,
    parameters: fakeParameters,
    timeRecordRepository: fakeRepository,
    templates: fakeTemplates,
    ...overrides,
  });
  return { container, auth, parameters: fakeParameters, repository: fakeRepository, templates: fakeTemplates };
}

/** Borrador completo y válido (miércoles 2026-09-09 por defecto). */
export function makeDraft(overrides: Partial<TimeRecord> = {}): TimeRecord {
  return {
    fecha: '2026-09-09',
    horaIni: '07:30',
    horaFin: '09:00',
    horas: '1.5',
    desc: 'Actividad de prueba',
    observacion: 'Actividad de prueba',
    cliente: 'Cliente Alfa',
    proyecto: 'Proyecto A',
    solicitud: 'Gestión Uno',
    gestionId: 'G-1',
    tipoHora: 'Laboral',
    funcional: '',
    ricef: '',
    ...overrides,
  };
}
