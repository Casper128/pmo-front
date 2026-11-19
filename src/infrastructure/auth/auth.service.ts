import { AuthGateway } from '@application/auth/auth.gateway';
import type { AuthUser } from '@domain/auth/auth-user.model';
import type { Environment } from '@env/environment';
import type { HttpClient } from '../http/http-client';

/** Claves de localStorage (las mismas que la app Angular). */
export const AUTH_STORAGE_KEYS = {
  token: 'pmo_token',
  refreshToken: 'pmo_refresh_token',
  user: 'pmo_user',
} as const;

/**
 * Port de `AuthService` (Angular) sin signals: estado privado + listeners para `useSyncExternalStore`.
 * Mismos endpoints, cabeceras, claves de almacenamiento, mensajes y reglas de sesión expirada.
 */
export class AuthService extends AuthGateway {
  private readonly http: HttpClient;
  private readonly env: Environment;
  private readonly listeners = new Set<() => void>();
  private _token: string | null = null;
  private _refreshToken: string | null = null;
  private _user: AuthUser | null = null;

  readonly user = (): AuthUser | null => this._user;
  readonly isLoggedIn = (): boolean => !!this._token;

  constructor(http: HttpClient, env: Environment) {
    super();
    this.http = http;
    this.env = env;
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.token);
    const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
    const userRaw = localStorage.getItem(AUTH_STORAGE_KEYS.user);
    if (token) this._token = token;
    if (refreshToken) this._refreshToken = refreshToken;
    if (userRaw) {
      try {
        this._user = JSON.parse(userRaw) as AuthUser;
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEYS.user);
      }
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

  async login(email: string, password: string): Promise<AuthUser> {
    const response = await this.http.post<unknown>(`${this.env.apiBaseUrl}/cuentas/authenticate`, {
      email,
      password,
    });
    const token = this.stringFrom(response, ['token', 'jwtToken', 'key', 'accessToken']);
    if (!token) {
      throw new Error(this.stringFrom(response, ['mensaje', 'message']) || 'Credenciales incorrectas');
    }
    this.setTokens(token, this.stringFrom(response, ['refreshToken']) || undefined);
    const responseRecord = this.asRecord(response);
    const user = this.mapUser(responseRecord?.['usuario'] || responseRecord?.['user'] || response, email);
    this.setUser(user);
    try {
      return await this.loadUser(user.email);
    } catch {
      return user;
    }
  }

  async loadUser(fallbackEmail: string): Promise<AuthUser> {
    const response = await this.http.get<unknown>(`${this.env.apiBaseUrl}/home/datosusuario`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const user = this.mapUser(response, fallbackEmail);
    this.setUser(user);
    return user;
  }

  async refreshSession(): Promise<string | null> {
    if (!this.token || !this.refreshToken) {
      throw new Error('No hay sesion para renovar');
    }

    const response = await this.http.post<unknown>(
      `${this.env.apiBaseUrl}/cuentas/validarSesion`,
      {
        refreshToken: this.refreshToken,
        jwtToken: this.token,
      },
      {
        headers: {
          accept: '*/*',
          'accept-language': 'es',
          Authorization: `Bearer ${this.token}`,
        },
      },
    );
    const token = this.stringFrom(response, ['key', 'token', 'jwtToken', 'accessToken']);
    const status = this.numberFrom(response, ['status']);
    const message = this.stringFrom(response, ['mensajee', 'mensaje', 'message']) || 'Sesion invalida';
    if (status !== null && status !== 200) throw new Error(message);
    if (!token) throw new Error(message);
    this.setTokens(token, this.refreshToken ?? undefined);
    return token;
  }

  async restoreSession(): Promise<AuthUser | null> {
    if (!this.token) return null;
    const fallbackEmail = this.user()?.email || 'Usuario PMO';
    const loadCurrentUser = () => this.loadUser(fallbackEmail);

    if (!this.refreshToken) {
      try {
        return await loadCurrentUser();
      } catch (error) {
        if (this.isSessionExpiredError(error)) this.clearTokens();
        return this.user();
      }
    }

    try {
      await this.refreshSession();
      return await loadCurrentUser();
    } catch (error) {
      if (this.isSessionExpiredError(error)) {
        this.clearTokens();
        return null;
      }
      try {
        return await loadCurrentUser();
      } catch (loadError) {
        if (this.isSessionExpiredError(loadError)) {
          this.clearTokens();
          return null;
        }
        return this.user();
      }
    }
  }

  setTokens(token: string, refreshToken?: string): void {
    this._token = token;
    localStorage.setItem(AUTH_STORAGE_KEYS.token, token);
    if (refreshToken) {
      this._refreshToken = refreshToken;
      localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, refreshToken);
    }
    this.notify();
  }

  setUser(user: AuthUser): void {
    this._user = user;
    localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
    this.notify();
  }

  clearTokens(): void {
    this._token = null;
    this._refreshToken = null;
    this._user = null;
    localStorage.removeItem(AUTH_STORAGE_KEYS.token);
    localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.user);
    this.notify();
  }

  isAuthenticated(): boolean {
    return !!this._token;
  }

  isSessionExpiredError(error: unknown): boolean {
    const status = this.numberFrom(error, ['status']) || 0;
    if (status === 401 || status === 403) return true;

    const message = this.stringFrom(error, ['mensajee', 'mensaje', 'message'])
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return (
      message.includes('sesion invalida') ||
      message.includes('session invalid') ||
      message.includes('jwt expired') ||
      message.includes('token expired')
    );
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }

  private mapUser(response: unknown, fallbackEmail: string): AuthUser {
    const email = this.stringFrom(response, ['email', 'correo', 'mail', 'usuarioEmail']) || fallbackEmail;
    const name =
      this.stringFrom(response, ['nombre', 'name', 'nombres', 'nombreCompleto', 'fullName', 'usuario']) ||
      email;

    return {
      name,
      email,
      id: this.stringOrNumberFrom(response, ['id', 'idUsuario', 'userId', 'codigo']) || undefined,
      role: this.stringFrom(response, ['rol', 'role', 'perfil', 'tipoUsuario']) || undefined,
      area: this.stringFrom(response, ['area', 'equipo', 'departamento']) || undefined,
      position: this.stringFrom(response, ['cargo', 'position', 'puesto']) || undefined,
      username: this.stringFrom(response, ['username', 'usuario', 'login']) || undefined,
      raw: response,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private findValue(value: unknown, keys: string[]): unknown {
    const record = this.asRecord(value);
    if (!record) return undefined;
    for (const key of keys) {
      const candidate = record[key];
      if (candidate !== undefined && candidate !== null && candidate !== '') return candidate;
    }
    for (const child of Object.values(record)) {
      const candidate = this.findValue(child, keys);
      if (candidate !== undefined) return candidate;
    }
    return undefined;
  }

  private stringFrom(value: unknown, keys: string[]): string {
    const candidate = this.findValue(value, keys);
    return typeof candidate === 'string' ? candidate : '';
  }

  private numberFrom(value: unknown, keys: string[]): number | null {
    const candidate = this.findValue(value, keys);
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private stringOrNumberFrom(value: unknown, keys: string[]): string | number | null {
    const candidate = this.findValue(value, keys);
    return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : null;
  }
}
