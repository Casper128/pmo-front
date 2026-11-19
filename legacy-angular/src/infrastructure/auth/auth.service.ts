import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { AuthUser } from '@domain/auth/auth-user.model';
import { AuthGateway } from '@application/auth/auth.gateway';

@Injectable()
export class AuthService extends AuthGateway {
  private http = inject(HttpClient);
  private _token = signal<string | null>(null);
  private _refreshToken = signal<string | null>(null);
  private _user = signal<AuthUser | null>(null);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  constructor() {
    super();
    const token = localStorage.getItem('pmo_token');
    const refreshToken = localStorage.getItem('pmo_refresh_token');
    const userRaw = localStorage.getItem('pmo_user');
    if (token) this._token.set(token);
    if (refreshToken) this._refreshToken.set(refreshToken);
    if (userRaw) {
      try {
        this._user.set(JSON.parse(userRaw));
      } catch {
        localStorage.removeItem('pmo_user');
      }
    }
  }

  get token(): string | null {
    return this._token();
  }

  get refreshToken(): string | null {
    return this._refreshToken();
  }

  login(email: string, password: string): Observable<AuthUser> {
    return this.http
      .post<unknown>(`${environment.apiBaseUrl}/cuentas/authenticate`, { email, password })
      .pipe(
        switchMap((response) => {
          const token = this.stringFrom(response, ['token', 'jwtToken', 'key', 'accessToken']);
          if (!token) {
            throw new Error(
              this.stringFrom(response, ['mensaje', 'message']) || 'Credenciales incorrectas',
            );
          }
          this.setTokens(token, this.stringFrom(response, ['refreshToken']) || undefined);
          const responseRecord = this.asRecord(response);
          const user = this.mapUser(
            responseRecord?.['usuario'] || responseRecord?.['user'] || response,
            email,
          );
          this.setUser(user);
          return this.loadUser(user.email).pipe(catchError(() => of(user)));
        }),
      );
  }

  loadUser(fallbackEmail: string): Observable<AuthUser> {
    return this.http
      .get<unknown>(`${environment.apiBaseUrl}/home/datosusuario`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      .pipe(
        map((response) => this.mapUser(response, fallbackEmail)),
        tap((user) => this.setUser(user)),
      );
  }

  refreshSession(): Observable<string | null> {
    if (!this.token || !this.refreshToken) {
      return throwError(() => new Error('No hay sesion para renovar'));
    }

    return this.http
      .post<unknown>(
        `${environment.apiBaseUrl}/cuentas/validarSesion`,
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
      )
      .pipe(
        map((response) => {
          const token = this.stringFrom(response, ['key', 'token', 'jwtToken', 'accessToken']);
          const status = this.numberFrom(response, ['status']);
          const message =
            this.stringFrom(response, ['mensajee', 'mensaje', 'message']) || 'Sesion invalida';
          if (status !== null && status !== 200) {
            throw new Error(message);
          }
          if (!token) {
            throw new Error(message);
          }
          return token as string;
        }),
        tap((token) => {
          if (token) this.setTokens(token, this.refreshToken ?? undefined);
        }),
      );
  }

  restoreSession(): Observable<AuthUser | null> {
    if (!this.token) return of(null);
    const fallbackEmail = this.user()?.email || 'Usuario PMO';
    const loadCurrentUser = () => this.loadUser(fallbackEmail);

    if (!this.refreshToken) {
      return loadCurrentUser().pipe(
        catchError((error) => {
          if (this.isSessionExpiredError(error)) this.clearTokens();
          return of(this.user());
        }),
      );
    }

    return this.refreshSession().pipe(
      switchMap(() => loadCurrentUser()),
      catchError((error) => {
        if (this.isSessionExpiredError(error)) {
          this.clearTokens();
          return of(null);
        }

        return loadCurrentUser().pipe(
          catchError((loadError) => {
            if (this.isSessionExpiredError(loadError)) {
              this.clearTokens();
              return of(null);
            }
            return of(this.user());
          }),
        );
      }),
    );
  }

  setTokens(token: string, refreshToken?: string) {
    this._token.set(token);
    localStorage.setItem('pmo_token', token);
    if (refreshToken) this._refreshToken.set(refreshToken);
    if (refreshToken) localStorage.setItem('pmo_refresh_token', refreshToken);
  }

  setUser(user: AuthUser) {
    this._user.set(user);
    localStorage.setItem('pmo_user', JSON.stringify(user));
  }

  clearTokens() {
    this._token.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
    localStorage.removeItem('pmo_token');
    localStorage.removeItem('pmo_refresh_token');
    localStorage.removeItem('pmo_user');
  }

  isAuthenticated(): boolean {
    return !!this._token();
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

  private mapUser(response: unknown, fallbackEmail: string): AuthUser {
    const email =
      this.stringFrom(response, ['email', 'correo', 'mail', 'usuarioEmail']) || fallbackEmail;
    const name =
      this.stringFrom(response, [
        'nombre',
        'name',
        'nombres',
        'nombreCompleto',
        'fullName',
        'usuario',
      ]) || email;

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
