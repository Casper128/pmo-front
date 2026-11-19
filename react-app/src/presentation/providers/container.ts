import { LoginUseCase } from '@application/auth/login.use-case';
import { RegisterTimeRecordUseCase } from '@application/time-records/use-cases/register-time-record.use-case';
import { SendAllRecordsUseCase } from '@application/time-records/use-cases/send-all-records.use-case';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { TimeDashboardCalculator } from '@domain/time-records/services/time-dashboard.calculator';
import { TimeRecordApiBodyBuilder } from '@domain/time-records/services/time-record-api-body.builder';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import type { Environment } from '@env/environment';
import { BrowserGeolocationAdapter } from '@infrastructure/audit/browser-geolocation.adapter';
import { SupabaseUserAuditAdapter } from '@infrastructure/audit/supabase-user-audit.adapter';
import { AuthService } from '@infrastructure/auth/auth.service';
import { AppParametersService } from '@infrastructure/configuration/app-parameters.service';
import { HttpClient } from '@infrastructure/http/http-client';
import { SupabaseNotificationAdapter } from '@infrastructure/notifications/supabase-notification.adapter';
import { ManagementDeleteRequestAdapter } from '@infrastructure/time-records/adapters/management-delete-request.adapter';
import { ManagementTemplateAdapter } from '@infrastructure/time-records/adapters/management-template.adapter';
import { SupabaseSendLogAdapter } from '@infrastructure/time-records/adapters/supabase-send-log.adapter';
import { TimeManagementHttpAdapter } from '@infrastructure/time-records/adapters/time-management-http.adapter';
import { TimeRecordHttpAdapter } from '@infrastructure/time-records/adapters/time-record-http.adapter';
import type { Container } from './container-context';

/**
 * Composition root: único archivo de presentación que instancia infraestructura (lo verifica
 * `check:architecture`). Se llama UNA vez en `main.tsx`, fuera del árbol React, para que StrictMode no
 * duplique servicios con estado (`AuthService`, `AppParametersService`, cachés de plantillas y opciones).
 * `overrides` sustituye piezas concretas (p. ej. en pruebas de integración).
 */
export function createContainer(environment: Environment, overrides: Partial<Container> = {}): Container {
  const http = new HttpClient();
  const auth = overrides.auth ?? new AuthService(http, environment);
  const parameters = overrides.parameters ?? new AppParametersService(auth, environment);
  const timeRecordRepository =
    overrides.timeRecordRepository ?? new TimeRecordHttpAdapter(http, auth, environment);
  const templates = overrides.templates ?? new ManagementTemplateAdapter(http, auth, environment);
  const location = overrides.location ?? new BrowserGeolocationAdapter();
  const userAudit = overrides.userAudit ?? new SupabaseUserAuditAdapter(http, auth, environment);
  const apiBodyBuilder = overrides.apiBodyBuilder ?? new TimeRecordApiBodyBuilder(parameters);
  const registerTimeRecord =
    overrides.registerTimeRecord ??
    new RegisterTimeRecordUseCase(timeRecordRepository, location, userAudit, templates, apiBodyBuilder);

  return {
    environment,
    auth,
    parameters,
    timeRecordRepository,
    timeManagement: overrides.timeManagement ?? new TimeManagementHttpAdapter(http, auth, environment),
    sendLogs: overrides.sendLogs ?? new SupabaseSendLogAdapter(http, auth, environment),
    templates,
    deleteRequests: overrides.deleteRequests ?? new ManagementDeleteRequestAdapter(http, auth, environment),
    notifications: overrides.notifications ?? new SupabaseNotificationAdapter(http, auth, environment),
    location,
    userAudit,
    domainService: overrides.domainService ?? new TimeRecordDomainService(parameters),
    dashboardCalculator: overrides.dashboardCalculator ?? new TimeDashboardCalculator(parameters),
    apiBodyBuilder,
    registerTimeRecord,
    sendAllRecords: overrides.sendAllRecords ?? new SendAllRecordsUseCase(registerTimeRecord),
    login: overrides.login ?? new LoginUseCase(auth, location, userAudit),
    loadSelectOptions: overrides.loadSelectOptions ?? new LoadSelectOptionsUseCase(timeRecordRepository),
  };
}
