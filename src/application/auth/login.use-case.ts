import type { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import type { AuthUser } from '@domain/auth/auth-user.model';
import type { AuthGateway } from './auth.gateway';

/** Opciones de geolocalización de la auditoría de login (las mismas que Angular). */
export const LOGIN_LOCATION_REQUEST = { highAccuracy: false, maximumAgeMs: 300000, timeoutMs: 10000 } as const;

export class LoginUseCase {
  private readonly auth: AuthGateway;
  private readonly location: LocationGateway;
  private readonly audit: UserAuditGateway;

  constructor(auth: AuthGateway, location: LocationGateway, audit: UserAuditGateway) {
    this.auth = auth;
    this.location = location;
    this.audit = audit;
  }

  /**
   * Inicia sesión, publica el usuario y audita el acceso con la ubicación sin esperarla: un fallo de
   * geolocalización o de auditoría nunca bloquea ni rompe el login. El fallo de `auth.login` se propaga.
   */
  async execute(email: string, password: string): Promise<AuthUser> {
    const user = await this.auth.login(email, password);
    this.auth.setUser(user);
    void this.location
      .capture({ ...LOGIN_LOCATION_REQUEST })
      .then((workLocation) => this.audit.recordLogin(workLocation))
      .catch(() => undefined);
    return user;
  }
}
