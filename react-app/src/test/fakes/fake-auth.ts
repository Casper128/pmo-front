import { AuthGateway } from '@application/auth/auth.gateway';
import type { AuthUser } from '@domain/auth/auth-user.model';

/** Usuario ficticio (sin datos personales reales). */
export const testUser: AuthUser = { name: 'Ana Prueba', email: 'consultor@example.test' };

/**
 * Doble en memoria de `AuthGateway`. Los métodos asíncronos tienen un comportamiento por defecto
 * razonable y se sustituyen en cada test con `vi.spyOn(fake, 'login').mockRejectedValue(...)`.
 */
export class FakeAuthGateway extends AuthGateway {
  private readonly listeners = new Set<() => void>();
  private _token: string | null = null;
  private _refreshToken: string | null = null;
  private _user: AuthUser | null = null;

  readonly user = (): AuthUser | null => this._user;
  readonly isLoggedIn = (): boolean => !!this._token;

  constructor(session?: { user: AuthUser; token?: string; refreshToken?: string }) {
    super();
    if (session) {
      this._token = session.token ?? 'test-token';
      this._refreshToken = session.refreshToken ?? 'test-refresh-token';
      this._user = session.user;
    }
  }

  get token(): string | null {
    return this._token;
  }

  get refreshToken(): string | null {
    return this._refreshToken;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async login(email: string): Promise<AuthUser> {
    this.setTokens('test-token', 'test-refresh-token');
    const user = { ...testUser, email };
    this.setUser(user);
    return user;
  }

  async loadUser(fallbackEmail: string): Promise<AuthUser> {
    return this._user ?? { name: fallbackEmail, email: fallbackEmail };
  }

  async refreshSession(): Promise<string | null> {
    return this._token;
  }

  async restoreSession(): Promise<AuthUser | null> {
    return this._token ? this._user : null;
  }

  setTokens(token: string, refreshToken?: string): void {
    this._token = token;
    if (refreshToken) this._refreshToken = refreshToken;
    this.notify();
  }

  setUser(user: AuthUser): void {
    this._user = user;
    this.notify();
  }

  clearTokens(): void {
    this._token = null;
    this._refreshToken = null;
    this._user = null;
    this.notify();
  }

  isAuthenticated(): boolean {
    return !!this._token;
  }

  isSessionExpiredError(error: unknown): boolean {
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : 0;
    return status === 401 || status === 403;
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
