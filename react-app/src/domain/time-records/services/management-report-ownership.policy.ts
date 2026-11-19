import { AuthUser } from '../../auth/auth-user.model';
import { ManagementReport } from '../models/management-report.model';

/**
 * ¿El reporte de gestión pertenece al usuario autenticado?
 *
 * Pertenencia estricta: si ambos lados traen id, solo cuenta la igualdad de id. Si falta el id en alguno,
 * se exige igualdad exacta (normalizada) de correo/usuario. Solo un reporte sin id ni correo/usuario, pero
 * con nombre del consultor, se compara por igualdad exacta de nombre. Nunca se comparan subcadenas ni se
 * usa `funcional` como identidad. Un reporte sin ningún dato de identidad se acepta: la consulta ya viene
 * filtrada por consultor.
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
  if (userIds.length && recordIds.length) return userIds.some((id) => recordIds.includes(id));

  const recordLogins = [
    record.email,
    record.correo,
    record.usuario,
    record.usuario_tiemposConsultores?.email,
    record.usuario_tiemposConsultores?.correo,
    record.usuario_tiemposConsultores?.usuario,
  ]
    .filter(hasValue)
    .map(normalize);
  const recordNames = [
    record.consultor,
    record.nombreConsultor,
    record.usuario_tiemposConsultores?.nombre,
  ]
    .filter(hasValue)
    .map(normalize);
  if (!recordIds.length && !recordLogins.length) {
    if (!recordNames.length) return true;
    const userNames = [user.name, rawUser('nombre'), rawUser('nombreCompleto')]
      .filter(hasValue)
      .map(normalize);
    return userNames.some((name) => recordNames.includes(name));
  }

  const userLogins = [
    user.email,
    user.username,
    rawUser('correo'),
    rawUser('mail'),
    rawUser('usuario'),
  ]
    .filter(hasValue)
    .map(normalize);
  return userLogins.some((login) => recordLogins.includes(login));
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

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
