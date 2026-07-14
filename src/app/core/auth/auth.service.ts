import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';

const BASE = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';

export interface AuthUser {
  name: string;
  email: string;
  id?: string | number;
  role?: string;
  area?: string;
  position?: string;
  username?: string;
  raw?: unknown;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private _token = signal<string | null>(null);
  private _refreshToken = signal<string | null>(null);
  private _user = signal<AuthUser | null>(null);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  constructor() {
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
      .post<any>(`${BASE}/cuentas/authenticate`, { email, password })
      .pipe(
        switchMap(response => {
          const token = response?.token || response?.jwtToken || response?.key || response?.accessToken;
          if (!token) {
            throw new Error(response?.mensaje || response?.message || 'Credenciales incorrectas');
          }
          this.setTokens(token, response?.refreshToken);
          const user = this.mapUser(response?.usuario || response?.user || response, email);
          this.setUser(user);
          return this.loadUser(user.email).pipe(
            catchError(() => of(user))
          );
        })
      );
  }

  loadUser(fallbackEmail: string): Observable<AuthUser> {
    return this.http
      .get<any>(`${BASE}/home/datosusuario`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      .pipe(
        map(response => this.mapUser(response, fallbackEmail)),
        tap(user => this.setUser(user))
      );
  }

  refreshSession(): Observable<string | null> {
    if (!this.token || !this.refreshToken) {
      return throwError(() => new Error('No hay sesion para renovar'));
    }

    return this.http
      .post<any>(
        `${BASE}/cuentas/validarSesion`,
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
        }
      )
      .pipe(
        map(response => {
          const token = response?.key || response?.token || response?.jwtToken || response?.accessToken;
          if (response?.status && response.status !== 200) {
            throw new Error(response?.mensajee || response?.mensaje || response?.message || 'Sesion invalida');
          }
          if (!token) {
            throw new Error(response?.mensajee || response?.mensaje || response?.message || 'Sesion invalida');
          }
          return token as string;
        }),
        tap(token => {
          if (token) this.setTokens(token, this.refreshToken ?? undefined);
        })
      );
  }

  restoreSession(): Observable<AuthUser | null> {
    if (!this.token) return of(null);
    const fallbackEmail = this.user()?.email || 'Usuario PMO';
    const loadCurrentUser = () => this.loadUser(fallbackEmail);

    if (!this.refreshToken) {
      return loadCurrentUser().pipe(
        catchError(error => {
          if (this.isSessionExpiredError(error)) this.clearTokens();
          return of(this.user());
        })
      );
    }

    return this.refreshSession().pipe(
      switchMap(() => loadCurrentUser()),
      catchError(error => {
        if (this.isSessionExpiredError(error)) {
          this.clearTokens();
          return of(null);
        }

        return loadCurrentUser().pipe(
          catchError(loadError => {
            if (this.isSessionExpiredError(loadError)) {
              this.clearTokens();
              return of(null);
            }
            return of(this.user());
          })
        );
      })
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

  isSessionExpiredError(error: any): boolean {
    const status = Number(error?.status || error?.error?.status || 0);
    if (status === 401 || status === 403) return true;

    const message = String(error?.error?.mensajee || error?.error?.mensaje || error?.error?.message || error?.message || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return message.includes('sesion invalida') ||
      message.includes('session invalid') ||
      message.includes('jwt expired') ||
      message.includes('token expired');
  }

  private mapUser(response: any, fallbackEmail: string): AuthUser {
    const email =
      response?.email ||
      response?.correo ||
      response?.mail ||
      response?.usuarioEmail ||
      fallbackEmail;
    const name =
      response?.nombre ||
      response?.name ||
      response?.nombres ||
      response?.nombreCompleto ||
      response?.fullName ||
      response?.usuario ||
      email;

    return {
      name,
      email,
      id: response?.id || response?.idUsuario || response?.userId || response?.codigo,
      role: response?.rol || response?.role || response?.perfil || response?.tipoUsuario,
      area: response?.area || response?.equipo || response?.departamento,
      position: response?.cargo || response?.position || response?.puesto,
      username: response?.username || response?.usuario || response?.login,
      raw: response,
    };
  }
}
