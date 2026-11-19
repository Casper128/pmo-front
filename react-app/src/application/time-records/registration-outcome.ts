import type { TimeRecordRegistrationResponse } from '@domain/time-records/models/time-record-api.model';

export interface RegistrationOutcome {
  ok: boolean;
  /** Identificador del tiempo registrado; vacío si la respuesta no lo trae. */
  identifier: string;
  /** Mensaje del servidor cuando no se confirmó el registro; vacío si fue exitoso. */
  message: string;
}

function nestedString(value: unknown, path: string[]): string {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : '';
}

function extractIdentifier(response: TimeRecordRegistrationResponse | null): string {
  const candidates = [
    response?.identificador,
    response?.id,
    nestedString(response?.data, ['identificador']),
    nestedString(response?.data, ['id']),
    nestedString(response?.data, ['row', 'identificador']),
    nestedString(response?.registro, ['identificador']),
    nestedString(response?.tiempo, ['identificador']),
  ];

  const direct = candidates.find((value) => typeof value === 'string' && value.trim());
  if (direct) return direct.trim();

  const text = JSON.stringify(response || {});
  const match = text.match(/RH-[^"\\]+?DO-\d+/i);
  return match?.[0]?.trim() || '';
}

function isSuccessful(response: TimeRecordRegistrationResponse | null): boolean {
  return (
    response?.status === 200 ||
    (typeof response?.mensaje === 'string' && response.mensaje.toLowerCase().includes('registrado'))
  );
}

/** Interpreta la respuesta del servidor al registrar un tiempo (formato heterogéneo del backend). */
export function interpretRegistration(response: TimeRecordRegistrationResponse | null): RegistrationOutcome {
  const ok = isSuccessful(response);
  return {
    ok,
    identifier: extractIdentifier(response),
    message: ok ? '' : response?.mensaje || response?.message || 'Respuesta no confirmada',
  };
}
