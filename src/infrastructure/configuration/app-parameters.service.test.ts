import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch, jsonResponse, requestAt, testEnvironment } from '@/test/http';
import { AuthService } from '../auth/auth.service';
import { HttpClient } from '../http/http-client';
import {
  APP_PARAMETERS_STORAGE_KEY,
  AppParametersService,
  DEFAULT_ADVANCED_FIELDS,
  DEFAULT_WORK_SETTINGS,
} from './app-parameters.service';

const ENDPOINT = `${testEnvironment.supabaseUrl}/functions/v1/pmo-config-admin`;

function signIn(email: string) {
  localStorage.setItem('pmo_token', 'token-1');
  localStorage.setItem('pmo_user', JSON.stringify({ name: 'Persona', email }));
}

function setup(...responses: Parameters<typeof fakeFetch>) {
  const auth = new AuthService(new HttpClient(fakeFetch(jsonResponse({}))), testEnvironment);
  const fetchMock = fakeFetch(...responses);
  const parameters = new AppParametersService(auth, testEnvironment, fetchMock);
  return { auth, parameters, fetchMock };
}

/** Espera a que termine la carga lanzada por el constructor. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AppParametersService', () => {
  beforeEach(() => localStorage.clear());

  it('sin sesión no consulta Supabase y usa los valores por defecto', async () => {
    const { parameters, fetchMock } = setup(jsonResponse({}));
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(parameters.source()).toBe('local');
    expect(parameters.configured()).toBe(true);
    expect(parameters.workSettings()).toEqual(DEFAULT_WORK_SETTINGS);
    expect(parameters.defaultFor('tipoHora')).toBe('Laboral');
    expect(parameters.valuesFor('complejidad')).toEqual(['Alta', 'Media', 'Baja']);
    expect(parameters.canManage()).toBe(false);
  });

  it('el auditor por defecto sale del entorno; sin él queda vacío', async () => {
    const withDefault = setup(jsonResponse({}));
    await settle();
    expect(withDefault.parameters.deletionSettings()).toEqual({
      auditorEmail: testEnvironment.defaultAuditorEmail,
      technicalDeleteEmails: [],
    });

    const emptyEnv = { ...testEnvironment, defaultAuditorEmail: '' };
    const auth = new AuthService(new HttpClient(fakeFetch(jsonResponse({}))), emptyEnv);
    const parameters = new AppParametersService(auth, emptyEnv, fakeFetch(jsonResponse({})));
    await settle();
    expect(parameters.deletionSettings().auditorEmail).toBe('');
  });

  it('carga desde Supabase con las cabeceras de Angular, aplica el payload y lo persiste', async () => {
    signIn('persona@example.test');
    const { parameters, fetchMock } = setup(
      jsonResponse({
        isAdmin: true,
        optionRows: [
          { field_key: 'complejidad', option_value: 'Baja', sort_order: 2, is_default: true },
          { field_key: 'complejidad', option_value: 'Alta', sort_order: 1 },
          { field_key: 'complejidad', option_value: 'Oculta', sort_order: 0, active: false },
        ],
        workSettings: {
          monday_thursday_hours: '9',
          friday_hours: 7,
          daily_hours: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 7 },
          max_daily_labor_hours: 11,
          max_hours_per_record: 30,
        },
        deletionSettings: { auditorEmail: ' Auditor@Example.test ', technicalDeleteEmails: ['Tec@Example.test', 'tec@example.test'] },
      }),
    );
    expect(parameters.loading()).toBe(true);
    await settle();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({
      method: 'GET',
      headers: { apikey: testEnvironment.supabasePublishableKey, Authorization: 'Bearer token-1' },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(parameters.loading()).toBe(false);
    expect(parameters.source()).toBe('supabase');
    expect(parameters.error()).toBe('');
    expect(parameters.valuesFor('complejidad')).toEqual(['Alta', 'Baja']);
    expect(parameters.defaultFor('complejidad')).toBe('Baja');
    expect(parameters.workSettings()).toMatchObject({
      mondayThursdayHours: 9,
      fridayHours: 7,
      maxDailyLaborHours: 11,
      maxHoursPerRecord: 24,
    });
    expect(parameters.deletionSettings()).toEqual({
      auditorEmail: 'auditor@example.test',
      technicalDeleteEmails: ['tec@example.test'],
    });
    expect(parameters.canUseTechnicalDelete('TEC@example.test')).toBe(true);
    expect(parameters.canManage()).toBe(true);
    expect(JSON.parse(localStorage.getItem(APP_PARAMETERS_STORAGE_KEY) ?? 'null')).toMatchObject({
      workSettings: { mondayThursdayHours: 9 },
    });
  });

  it('si Supabase falla usa los parámetros locales e informa el error', async () => {
    signIn('persona@example.test');
    localStorage.setItem(
      APP_PARAMETERS_STORAGE_KEY,
      JSON.stringify({ workSettings: { ...DEFAULT_WORK_SETTINGS, maxHoursPerRecord: 12 } }),
    );
    const { parameters } = setup(jsonResponse({ error: 'Sin permisos' }, 500, 'Error'));
    await settle();

    expect(parameters.source()).toBe('local');
    expect(parameters.error()).toBe('Sincronización no disponible; se usan parámetros locales. Sin permisos');
    expect(parameters.workSettings().maxHoursPerRecord).toBe(12);
    expect(parameters.canManage()).toBe(false);
  });

  it('canManage: correo de la lista del entorno (sin distinguir mayúsculas) o acceso del servidor', async () => {
    signIn('ADMIN@example.test');
    const { parameters } = setup(jsonResponse({ isAdmin: false }));
    await settle();
    expect(parameters.canManage()).toBe(true);
  });

  it('subscribe notifica los cambios de carga y del usuario autenticado hasta cancelar', async () => {
    signIn('persona@example.test');
    const { auth, parameters } = setup(jsonResponse({}));
    const listener = vi.fn();
    const unsubscribe = parameters.subscribe(listener);

    await settle();
    const afterLoad = listener.mock.calls.length;
    expect(afterLoad).toBeGreaterThan(0);

    auth.setUser({ name: 'Admin', email: 'admin@example.test' });
    expect(listener).toHaveBeenCalledTimes(afterLoad + 1);
    expect(parameters.canManage()).toBe(true);

    unsubscribe();
    auth.clearTokens();
    await parameters.load();
    expect(listener).toHaveBeenCalledTimes(afterLoad + 1);
  });

  it('save: solo administradores; envía el payload saneado con las mismas cabeceras', async () => {
    signIn('persona@example.test');
    const { auth, parameters, fetchMock } = setup(jsonResponse({}), jsonResponse({ ok: true }));
    await settle();
    await expect(parameters.save(DEFAULT_ADVANCED_FIELDS, DEFAULT_WORK_SETTINGS, { auditorEmail: '', technicalDeleteEmails: [] })).rejects.toThrow(
      'Solo el administrador puede guardar la configuración global.',
    );

    auth.setUser({ name: 'Admin', email: 'admin@example.test' });
    await parameters.save(DEFAULT_ADVANCED_FIELDS, { ...DEFAULT_WORK_SETTINGS, maxDailyLaborHours: 9 }, {
      auditorEmail: 'Auditor@Example.test',
      technicalDeleteEmails: [],
    });

    const request = requestAt(fetchMock, 1);
    expect(request).toMatchObject({
      url: ENDPOINT,
      method: 'POST',
      headers: {
        apikey: testEnvironment.supabasePublishableKey,
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json',
      },
      body: {
        workSettings: { maxDailyLaborHours: 9 },
        deletionSettings: { auditorEmail: 'auditor@example.test', technicalDeleteEmails: [] },
      },
    });
    expect(parameters.saving()).toBe(false);
    expect(parameters.source()).toBe('supabase');
    expect(parameters.workSettings().maxDailyLaborHours).toBe(9);
  });
});

describe('AppParametersService · load() tras el login (corrección QA F4)', () => {
  beforeEach(() => localStorage.clear());

  it('marca loading=true de forma síncrona al llamar load() para que los guards esperen', async () => {
    let respond: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (respond = resolve)));
    const auth = new AuthService(new HttpClient(fakeFetch(jsonResponse({}))), testEnvironment);
    const parameters = new AppParametersService(auth, testEnvironment, fetchMock);
    await settle();
    // Sin sesión el constructor no consulta Supabase.
    expect(parameters.loading()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    // Igual que AuthGate tras el login: hay token y se lanza `load()` sin esperar.
    auth.setTokens('token-1');
    auth.setUser({ name: 'Admin', email: 'admin@example.test' });
    const snapshots: boolean[] = [];
    parameters.subscribe(() => snapshots.push(parameters.loading()));

    const pending = parameters.load();

    // Antes de cualquier await: loading ya es true y los suscriptores lo han visto.
    expect(parameters.loading()).toBe(true);
    expect(snapshots).toContain(true);

    respond(jsonResponse({ isAdmin: true }));
    await pending;
    expect(parameters.loading()).toBe(false);
    expect(parameters.canManage()).toBe(true);
  });
});
