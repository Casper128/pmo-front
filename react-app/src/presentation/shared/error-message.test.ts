import { apiErrorMessage } from './error-message';

describe('apiErrorMessage', () => {
  it('usa el mensaje del cuerpo del servidor (error o message) tal cual', () => {
    expect(apiErrorMessage({ status: 400, message: 'Http failure', error: { error: 'Horario no permitido' } }, 'Falló')).toBe('Horario no permitido');
    expect(apiErrorMessage({ status: 409, message: 'Http failure', error: { message: 'Ya existe' } }, 'Falló')).toBe('Ya existe');
    expect(apiErrorMessage({ status: 400, message: 'Http failure', error: 'Texto plano' }, 'Falló')).toBe('Texto plano');
  });

  it('usa el fallback si no hay mensaje o es un fallo de red', () => {
    expect(apiErrorMessage({ status: 0, message: 'Failed to fetch', error: new TypeError('Failed to fetch') }, 'Falló')).toBe('Falló');
    expect(apiErrorMessage(undefined, 'Falló')).toBe('Falló');
  });
});
