import { Observable } from 'rxjs';
import { AuthUser } from '@domain/auth/auth-user.model';

export abstract class AuthGateway {
  abstract readonly user: () => AuthUser | null;
  abstract readonly isLoggedIn: () => boolean;
  abstract get token(): string | null;
  abstract get refreshToken(): string | null;
  abstract login(email: string, password: string): Observable<AuthUser>;
  abstract loadUser(fallbackEmail: string): Observable<AuthUser>;
  abstract refreshSession(): Observable<string | null>;
  abstract restoreSession(): Observable<AuthUser | null>;
  abstract setTokens(token: string, refreshToken?: string): void;
  abstract setUser(user: AuthUser): void;
  abstract clearTokens(): void;
  abstract isAuthenticated(): boolean;
  abstract isSessionExpiredError(error: unknown): boolean;
}
