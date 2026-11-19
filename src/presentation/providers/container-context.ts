import { createContext, useContext } from 'react';
import type { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import type { AuthGateway } from '@application/auth/auth.gateway';
import type { LoginUseCase } from '@application/auth/login.use-case';
import type { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import type { NotificationGateway } from '@application/notifications/notification.gateway';
import type { ManagementDeleteRequestGateway } from '@application/time-records/ports/management-delete-request.gateway';
import type { ManagementTemplateGateway } from '@application/time-records/ports/management-template.gateway';
import type { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import type { RegisterTimeRecordUseCase } from '@application/time-records/use-cases/register-time-record.use-case';
import type { SendAllRecordsUseCase } from '@application/time-records/use-cases/send-all-records.use-case';
import type { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import type { TimeDashboardCalculator } from '@domain/time-records/services/time-dashboard.calculator';
import type { TimeRecordApiBodyBuilder } from '@domain/time-records/services/time-record-api-body.builder';
import type { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import type { Environment } from '@env/environment';

/**
 * Grafo de dependencias de la app (equivalente a `app.config.ts` + `TIME_RECORDS_PROVIDERS` de Angular).
 * Solo expone puertos de application/domain: la presentación nunca ve implementaciones de infrastructure.
 */
export interface Container {
  readonly environment: Environment;
  readonly auth: AuthGateway;
  readonly parameters: AppParametersFacade;
  readonly timeRecordRepository: TimeRecordRepository;
  readonly timeManagement: TimeManagementGateway;
  readonly sendLogs: SendLogGateway;
  readonly templates: ManagementTemplateGateway;
  readonly deleteRequests: ManagementDeleteRequestGateway;
  readonly notifications: NotificationGateway;
  readonly location: LocationGateway;
  readonly userAudit: UserAuditGateway;
  readonly domainService: TimeRecordDomainService;
  readonly dashboardCalculator: TimeDashboardCalculator;
  readonly apiBodyBuilder: TimeRecordApiBodyBuilder;
  readonly registerTimeRecord: RegisterTimeRecordUseCase;
  readonly sendAllRecords: SendAllRecordsUseCase;
  readonly login: LoginUseCase;
  readonly loadSelectOptions: LoadSelectOptionsUseCase;
}

export const ContainerContext = createContext<Container | null>(null);

/** Devuelve el contenedor creado en `main.tsx` (o el de pruebas). */
export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) throw new Error('useContainer debe usarse dentro de <AppProviders>.');
  return container;
}
