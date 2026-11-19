import type { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import type { AuthUser } from '@domain/auth/auth-user.model';

const normalizeEmail = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

/**
 * Quién puede revisar solicitudes de eliminación: misma lógica que `canReviewDeleteRequests` del shell
 * Angular y `canReview` de su página de auditoría (aquí unificada en una sola función).
 */
export function canReviewDeleteRequests(user: AuthUser | null, parameters: AppParametersFacade): boolean {
  const identities = [user?.email, user?.username].map((value) => normalizeEmail(value));
  const auditor = normalizeEmail(parameters.deletionSettings().auditorEmail);
  const role = normalizeEmail(user?.role);
  return (
    parameters.canManage() ||
    parameters.canUseTechnicalDelete(user?.email) ||
    parameters.canUseTechnicalDelete(user?.username) ||
    (!!auditor && identities.includes(auditor)) ||
    role === 'admin' ||
    role.includes('auditor')
  );
}

/** Igual que `locationAdminGuard` de Angular: el email normalizado debe estar en la lista del entorno. */
export function isLocationAdmin(user: AuthUser | null, locationAdminEmails: readonly string[]): boolean {
  return locationAdminEmails.includes(normalizeEmail(user?.email));
}

/** Iniciales del usuario como en Angular (`initials()`): nombre, email o `PMO`; máximo 2 letras. */
export function userInitials(user: AuthUser | null): string {
  const name = user?.name || user?.email || 'PMO';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}
