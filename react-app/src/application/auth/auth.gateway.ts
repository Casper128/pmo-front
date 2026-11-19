import type { AuthUser } from '@domain/auth/auth-user.model';

export abstract class AuthGateway {
  abstract readonly user: () => AuthUser | null;
  abstract readonly isLoggedIn: () => boolean;
  abstract get token(): string | null;
  abstract get refreshToken(): string | null;
  abstract login(email: string, password: string): Promise<AuthUser>;
  abstract loadUser(fallbackEmail: string): Promise<AuthUser>;
  abstract refreshSession(): Promise<string | null>;
  abstract restoreSession(): Promise<AuthUser | null>;
  abstract setTokens(token: string, refreshToken?: string): void;
  abstract setUser(user: AuthUser): void;
  abstract clearTokens(): void;
  abstract isAuthenticated(): boolean;
  abstract isSessionExpiredError(error: unknown): boolean;
  /**
   * Notifica cambios de usuario o sesión (para `useSyncExternalStore`). Devuelve la función para
   * cancelar la suscripción. Sustituye a los signals de Angular.
   */
  abstract subscribe(listener: () => void): () => void;
}
