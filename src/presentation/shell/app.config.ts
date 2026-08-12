import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { TIME_RECORDS_PROVIDERS } from './providers/time-records.providers';
import { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import { BrowserGeolocationAdapter } from '@infrastructure/audit/browser-geolocation.adapter';
import { SupabaseUserAuditAdapter } from '@infrastructure/audit/supabase-user-audit.adapter';
import { AuthGateway } from '@application/auth/auth.gateway';
import { AuthService } from '@infrastructure/auth/auth.service';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { AppParametersService } from '@infrastructure/configuration/app-parameters.service';
import { ConsultantLocationGateway } from '@application/audit/consultant-location.gateway';
import { SupabaseConsultantLocationAdapter } from '@infrastructure/audit/supabase-consultant-location.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: AuthGateway, useClass: AuthService },
    { provide: AppParametersFacade, useClass: AppParametersService },
    ...TIME_RECORDS_PROVIDERS,
    { provide: LocationGateway, useClass: BrowserGeolocationAdapter },
    { provide: UserAuditGateway, useClass: SupabaseUserAuditAdapter },
    { provide: ConsultantLocationGateway, useClass: SupabaseConsultantLocationAdapter },
  ],
};
