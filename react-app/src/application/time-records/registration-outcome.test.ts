import { describe, expect, it } from 'vitest';
import { interpretRegistration } from './registration-outcome';

describe('interpretRegistration', () => {
  it('éxito por status 200 o por mensaje "registrado" (sin distinguir mayúsculas)', () => {
    expect(interpretRegistration({ status: 200 }).ok).toBe(true);
    expect(interpretRegistration({ mensaje: 'Tiempo REGISTRADO' })).toMatchObject({ ok: true, message: '' });
  });

  it('extrae el identificador directo, anidado o por patrón RH-…DO-n', () => {
    expect(interpretRegistration({ status: 200, identificador: ' RH-1 ' }).identifier).toBe('RH-1');
    expect(interpretRegistration({ status: 200, data: { row: { identificador: 'RH-2' } } }).identifier).toBe('RH-2');
    expect(interpretRegistration({ tiempo: { identificador: 'RH-3' } }).identifier).toBe('RH-3');
    expect(interpretRegistration({ status: 200, detalle: 'Creado RH-2026-09-09-DO-77 ok' }).identifier).toBe(
      'RH-2026-09-09-DO-77',
    );
    expect(interpretRegistration({ status: 200 }).identifier).toBe('');
  });

  it('sin confirmar usa mensaje, message o "Respuesta no confirmada"', () => {
    expect(interpretRegistration({ status: 500, mensaje: 'Gestión cerrada' })).toMatchObject({
      ok: false,
      message: 'Gestión cerrada',
    });
    expect(interpretRegistration({ status: 500, message: 'Otro' }).message).toBe('Otro');
    expect(interpretRegistration({ status: 202 }).message).toBe('Respuesta no confirmada');
    expect(interpretRegistration(null)).toEqual({ ok: false, identifier: '', message: 'Respuesta no confirmada' });
  });
});
