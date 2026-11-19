import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch, jsonResponse, requestAt, testEnvironment } from '@/test/http';
import { HttpClient } from '../http/http-client';
import { HttpError } from '../http/http-error';
import { AuthService } from './auth.service';

const API = testEnvironment.apiBaseUrl;
const ACCEPT = 'application/json, text/plain, */*';
const storedUser = { name: 'Persona Prueba', email: 'persona@example.test' };

function setup(...responses: Parameters<typeof fakeFetch>) {
  const fetchMock = fakeFetch(...responses);
  const auth = new AuthService(new HttpClient(fetchMock), testEnvironment);
  return { auth, fetchMock };
}

function storeSession({ refresh = true } = {}) {
  localStorage.setItem('pmo_token', 'token-viejo');
  if (refresh) localStorage.setItem('pmo_refresh_token', 'refresh-1');
  localStorage.setItem('pmo_user', JSON.stringify(storedUser));
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('lee la sesión de localStorage al construirse y descarta un usuario corrupto', () => {
    storeSession();
    const { auth } = setup(jsonResponse({}));
    expect(auth.token).toBe('token-viejo');
    expect(auth.refreshToken).toBe('refresh-1');
    expect(auth.user()).toEqual(storedUser);
    expect(auth.isLoggedIn()).toBe(true);

    localStorage.setItem('pmo_user', '{corrupto');
    const second = setup(jsonResponse({})).auth;
    expect(second.user()).toBeNull();
    expect(localStorage.getItem('pmo_user')).toBeNull();
  });

  it('login: autentica, guarda tokens y usuario, y carga los datos del usuario con Bearer', async () => {
    const { auth, fetchMock } = setup(
      jsonResponse({ jwtToken: 'token-1', refreshToken: 'refresh-1', usuario: { nombre: 'Login', email: 'persona@example.test' } }),
      jsonResponse({ data: { nombreCompleto: 'Persona Prueba', correo: 'persona@example.test', idUsuario: 7, cargo: 'Consultor' } }),
    );
    const listener = vi.fn();
    auth.subscribe(listener);

    const user = await auth.login('persona@example.test', 'secreto');

    expect(requestAt(fetchMock, 0)).toEqual({
      url: `${API}/cuentas/authenticate`,
      method: 'POST',
      headers: { Accept: ACCEPT, 'Content-Type': 'application/json' },
      body: { email: 'persona@example.test', password: 'secreto' },
    });
    expect(requestAt(fetchMock, 1)).toEqual({
      url: `${API}/home/datosusuario`,
      method: 'GET',
      headers: { Authorization: 'Bearer token-1', Accept: ACCEPT },
      body: null,
    });
    expect(user).toMatchObject({ name: 'Persona Prueba', email: 'persona@example.test', id: 7, position: 'Consultor' });
    expect(localStorage.getItem('pmo_token')).toBe('token-1');
    expect(localStorage.getItem('pmo_refresh_token')).toBe('refresh-1');
    expect(JSON.parse(localStorage.getItem('pmo_user') ?? 'null')).toMatchObject({ name: 'Persona Prueba' });
    expect(auth.isAuthenticated()).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it('login: sin token lanza el mensaje del backend o "Credenciales incorrectas"', async () => {
    await expect(setup(jsonResponse({ mensaje: 'Usuario bloqueado' })).auth.login('a@example.test', 'x')).rejects.toThrow(
      'Usuario bloqueado',
    );
    await expect(setup(jsonResponse({})).auth.login('a@example.test', 'x')).rejects.toThrow('Credenciales incorrectas');
  });

  it('login: si falla la carga del usuario devuelve el usuario de la respuesta', async () => {
    const { auth } = setup(jsonResponse({ token: 'token-1', nombre: 'Desde login' }), jsonResponse({}, 500, 'Error'));
    await expect(auth.login('persona@example.test', 'x')).resolves.toMatchObject({
      name: 'Desde login',
      email: 'persona@example.test',
    });
  });

  it('refreshSession: mismas cabeceras y cuerpo que Angular y guarda el nuevo token', async () => {
    storeSession();
    const { auth, fetchMock } = setup(jsonResponse({ status: 200, key: 'token-nuevo' }));

    await expect(auth.refreshSession()).resolves.toBe('token-nuevo');

    expect(requestAt(fetchMock)).toEqual({
      url: `${API}/cuentas/validarSesion`,
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-language': 'es',
        Authorization: 'Bearer token-viejo',
        'Content-Type': 'application/json',
      },
      body: { refreshToken: 'refresh-1', jwtToken: 'token-viejo' },
    });
    expect(auth.token).toBe('token-nuevo');
    expect(localStorage.getItem('pmo_token')).toBe('token-nuevo');
    expect(localStorage.getItem('pmo_refresh_token')).toBe('refresh-1');
  });

  it('refreshSession: sin sesión o con status distinto de 200 rechaza con el mensaje', async () => {
    await expect(setup(jsonResponse({})).auth.refreshSession()).rejects.toThrow('No hay sesion para renovar');
    storeSession();
    await expect(setup(jsonResponse({ status: 401, mensajee: 'Sesion invalida' })).auth.refreshSession()).rejects.toThrow(
      'Sesion invalida',
    );
  });

  it('restoreSession: sin token devuelve null sin llamar a la API', async () => {
    const { auth, fetchMock } = setup(jsonResponse({}));
    await expect(auth.restoreSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restoreSession: renueva la sesión y recarga el usuario', async () => {
    storeSession();
    const { auth, fetchMock } = setup(
      jsonResponse({ status: 200, token: 'token-nuevo' }),
      jsonResponse({ nombre: 'Persona Actualizada' }),
    );

    await expect(auth.restoreSession()).resolves.toMatchObject({
      name: 'Persona Actualizada',
      email: 'persona@example.test',
    });
    expect(requestAt(fetchMock, 1).headers['Authorization']).toBe('Bearer token-nuevo');
  });

  it('restoreSession: sesión expirada (401) limpia tokens y devuelve null', async () => {
    storeSession();
    const { auth } = setup(jsonResponse({ message: 'expired' }, 401, 'Unauthorized'));
    const listener = vi.fn();
    auth.subscribe(listener);

    await expect(auth.restoreSession()).resolves.toBeNull();
    expect(auth.token).toBeNull();
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem('pmo_token')).toBeNull();
    expect(localStorage.getItem('pmo_refresh_token')).toBeNull();
    expect(localStorage.getItem('pmo_user')).toBeNull();
    expect(listener).toHaveBeenCalled();
  });

  it('restoreSession: un fallo de refresh no relacionado con la sesión intenta cargar el usuario', async () => {
    storeSession();
    const { auth, fetchMock } = setup(jsonResponse({}, 500, 'Error'), jsonResponse({ nombre: 'Recuperado' }));
    await expect(auth.restoreSession()).resolves.toMatchObject({ name: 'Recuperado' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth.token).toBe('token-viejo');
  });

  it('restoreSession: sin refresh token y API caída conserva el usuario guardado', async () => {
    storeSession({ refresh: false });
    const { auth } = setup(new TypeError('Failed to fetch'));
    await expect(auth.restoreSession()).resolves.toEqual(storedUser);
    expect(auth.token).toBe('token-viejo');
  });

  it('isSessionExpiredError: 401/403 y mensajes de sesión inválida, no otros errores', () => {
    const { auth } = setup(jsonResponse({}));
    expect(auth.isSessionExpiredError(new HttpError({ status: 401, statusText: 'Unauthorized' }))).toBe(true);
    expect(auth.isSessionExpiredError(new HttpError({ status: 403, statusText: 'Forbidden' }))).toBe(true);
    expect(auth.isSessionExpiredError(new Error('Sesión inválida'))).toBe(true);
    expect(auth.isSessionExpiredError({ error: { mensaje: 'JWT expired' } })).toBe(true);
    expect(auth.isSessionExpiredError(new HttpError({ status: 500, statusText: 'Error' }))).toBe(false);
    expect(auth.isSessionExpiredError(new HttpError({ status: 0, error: new TypeError('Failed to fetch') }))).toBe(false);
    expect(auth.isSessionExpiredError(null)).toBe(false);
  });

  it('subscribe notifica setUser, setTokens y clearTokens hasta cancelar la suscripción', () => {
    const { auth } = setup(jsonResponse({}));
    const listener = vi.fn();
    const unsubscribe = auth.subscribe(listener);

    auth.setTokens('t', 'r');
    auth.setUser(storedUser);
    auth.clearTokens();
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    auth.setUser(storedUser);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
