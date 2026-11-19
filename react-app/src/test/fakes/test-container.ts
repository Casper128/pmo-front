import { vi } from 'vitest';
import type { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { RegisterTimeRecordUseCase } from '@application/time-records/use-cases/register-time-record.use-case';
import { SendAllRecordsUseCase } from '@application/time-records/use-cases/send-all-records.use-case';
import { TimeDashboardCalculator } from '@domain/time-records/services/time-dashboard.calculator';
import { TimeRecordApiBodyBuilder } from '@domain/time-records/services/time-record-api-body.builder';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import type { Container } from '@presentation/providers/container-context';
import { testEnvironment } from '../http';
import { FakeAppParameters } from './fake-app-parameters';
import { FakeAuthGateway } from './fake-auth';

/** Puerto no usado por el test: cualquier acceso falla con un mensaje claro. */
function unavailable<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get: (_target, property) => {
      throw new Error(`${name}.${String(property)} no está disponible en este test`);
    },
  });
}

/**
 * Contenedor de pruebas: dobles en memoria de auth, parámetros, geolocalización y auditoría; el resto de
 * puertos falla si se usa. Nunca toca red ni servicios reales.
 */
export function createTestContainer(overrides: Partial<Container> = {}): Container {
  const auth = overrides.auth ?? new FakeAuthGateway();
  const parameters = overrides.parameters ?? new FakeAppParameters({}, auth);
  const location: LocationGateway = overrides.location ?? {
    capture: vi.fn(async () => ({ latitude: null, longitude: null, accuracy: null, locationStatus: 'unsupported' as const })),
  };
  const userAudit: UserAuditGateway = overrides.userAudit ?? {
    recordLogin: vi.fn(async () => undefined),
    recordTimeReport: vi.fn(async () => undefined),
  };
  const timeRecordRepository = overrides.timeRecordRepository ?? unavailable('timeRecordRepository');
  const templates = overrides.templates ?? unavailable('templates');
  const apiBodyBuilder = overrides.apiBodyBuilder ?? new TimeRecordApiBodyBuilder(parameters);
  const registerTimeRecord =
    overrides.registerTimeRecord ??
    new RegisterTimeRecordUseCase(timeRecordRepository, location, userAudit, templates, apiBodyBuilder);

  return {
    environment: testEnvironment,
    auth,
    parameters,
    timeRecordRepository,
    timeManagement: unavailable('timeManagement'),
    sendLogs: unavailable('sendLogs'),
    templates,
    deleteRequests: unavailable('deleteRequests'),
    location,
    userAudit,
    consultantLocations: unavailable('consultantLocations'),
    domainService: new TimeRecordDomainService(parameters),
    dashboardCalculator: new TimeDashboardCalculator(parameters),
    apiBodyBuilder,
    registerTimeRecord,
    sendAllRecords: new SendAllRecordsUseCase(registerTimeRecord),
    loadSelectOptions: new LoadSelectOptionsUseCase(timeRecordRepository),
    ...overrides,
  };
}
