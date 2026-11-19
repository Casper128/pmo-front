import { AuthUser } from '../../auth/auth-user.model';
import { ManagementReport } from '../models/management-report.model';

/**
 * ¿El reporte de gestión pertenece al usuario autenticado?
 * Extracción literal de `isCurrentUserRecord` (consultant-statistics-page) e
 * `isCurrentUserReport` (multiple-import-page), que hoy son equivalentes.
 * Esas páginas conservan su copia; migrarlas queda fuera de este cambio.
 */
export function isManagementReportOwnedBy(
  record: ManagementReport,
  user: AuthUser | null,
): boolean {
  if (!user) return false;
  const rawUser = (key: string): unknown =>
    user.raw && typeof user.raw === 'object'
      ? (user.raw as Record<string, unknown>)[key]
      : undefined;

  const userIds = [user.id, rawUser('id'), rawUser('idUsuario'), rawUser('userId')]
    .filter(hasValue)
    .map((value) => String(value).trim());
  const recordIds = [
    record.idConsultor,
    record.idUsuario,
    record.usuario_tiemposConsultores?.id,
    valueFromObject(record, 'idConsultor'),
    valueFromObject(record, 'idUsuario'),
    valueFromObject(record, 'userId'),
  ]
    .filter(hasValue)
    .map((value) => String(value).trim());
  if (recordIds.length && userIds.some((id) => recordIds.includes(id))) return true;

  const userNames = [
    user.email,
    user.username,
    user.name,
    rawUser('correo'),
    rawUser('mail'),
    rawUser('usuario'),
    rawUser('nombre'),
    rawUser('nombreCompleto'),
  ]
    .filter(hasValue)
    .map(normalize);
  const recordNames = [
    record.email,
    record.correo,
    record.usuario,
    record.consultor,
    record.nombreConsultor,
    record.funcional,
    record.usuario_tiemposConsultores?.email,
    record.usuario_tiemposConsultores?.correo,
    record.usuario_tiemposConsultores?.usuario,
    record.usuario_tiemposConsultores?.nombre,
    ...collectIdentityText(record),
  ]
    .filter(hasValue)
    .map(normalize);
  if (!recordIds.length && !recordNames.length) return true;
  return userNames.some((name) =>
    recordNames.some(
      (candidate) => candidate === name || candidate.includes(name) || name.includes(candidate),
    ),
  );
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function valueFromObject(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const object = value as Record<string, unknown>;
  if (key in object) return object[key];
  for (const child of Object.values(object)) {
    const found = valueFromObject(child, key);
    if (hasValue(found)) return found;
  }
  return undefined;
}

function collectIdentityText(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return [];
  const identityKey = /(consultor|usuario|user|email|correo|mail|funcional|nombre)/i;
  const result: unknown[] = [];
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    if (identityKey.test(key) && (typeof child === 'string' || typeof child === 'number'))
      result.push(child);
    if (child && typeof child === 'object') result.push(...collectIdentityText(child));
  });
  return result;
}

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
