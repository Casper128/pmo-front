import { beforeEach, describe, expect, it } from 'vitest';
import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { fakeFetch, jsonResponse, requestAt, testEnvironment } from '@/test/http';
import { AuthService } from '../../auth/auth.service';
import { HttpClient } from '../../http/http-client';
import { ManagementTemplateAdapter } from './management-template.adapter';

const ENDPOINT = `${testEnvironment.supabaseUrl}/functions/v1/pmo-management-templates`;
const STORAGE_KEY = 'pmo_management_templates_v1_persona@example.test';
const HEADERS = {
  apikey: testEnvironment.supabasePublishableKey,
  Authorization: 'Bearer token-1',
  'Content-Type': 'application/json',
  Accept: 'application/json, text/plain, */*',
};

const template = (gestionId: string, extra: Partial<ManagementAdvancedTemplate> = {}): ManagementAdvancedTemplate => ({
  gestionId,
  gestionName: `Gestión ${gestionId}`,
  values: { tipoActividad: 'Soporte' },
  completed: true,
  ...extra,
});

function setup(...responses: Parameters<typeof fakeFetch>) {
  const fetchMock = fakeFetch(...responses);
  const http = new HttpClient(fetchMock);
  const auth = new AuthService(http, testEnvironment);
  return { adapter: new ManagementTemplateAdapter(http, auth, testEnvironment), fetchMock };
}

describe('ManagementTemplateAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pmo_token', 'token-1');
    localStorage.setItem('pmo_user', JSON.stringify({ name: 'Persona', email: 'persona@example.test' }));
  });

  it('list: GET con apikey/Bearer, combina datos locales de control y persiste por usuario', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([template('G1', { client: 'Cliente local' })]));
    const { adapter, fetchMock } = setup(jsonResponse({ templates: [template('G1'), { gestionName: 'sin id' }] }));

    const result = await adapter.list();

    expect(requestAt(fetchMock)).toEqual({ url: ENDPOINT, method: 'GET', headers: HEADERS, body: null });
    expect(result).toEqual([expect.objectContaining({ gestionId: 'G1', client: 'Cliente local' })]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });

  it('get: query gestionId codificada; si falla usa la copia local', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([template('G 1')]));
    const { adapter, fetchMock } = setup(new TypeError('Failed to fetch'));

    await expect(adapter.get(' G 1 ')).resolves.toMatchObject({ gestionId: 'G 1' });
    expect(requestAt(fetchMock).url).toBe(`${ENDPOINT}?gestionId=G%201`);
    await expect(adapter.get('')).resolves.toBeNull();
  });

  it('remove: DELETE con cuerpo JSON; un 403 se relanza sin tocar la copia local', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([template('G1')]));
    const { adapter, fetchMock } = setup(jsonResponse({ error: 'Sin permiso' }, 403, 'Forbidden'), jsonResponse({}));

    await expect(adapter.remove('G1')).rejects.toMatchObject({ status: 403 });
    expect(requestAt(fetchMock)).toEqual({ url: ENDPOINT, method: 'DELETE', headers: HEADERS, body: { gestionId: 'G1' } });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);

    await adapter.remove('G1');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(0);
  });

  it('save: POST saneado; ante un error distinto de 403 guarda localmente', async () => {
    const { adapter, fetchMock } = setup(jsonResponse({}, 500, 'Error'));
    const saved = await adapter.save(template('G2', { values: { causa: 'Soporte' } }));
    expect(requestAt(fetchMock)).toMatchObject({ method: 'POST', body: { gestionId: 'G2', values: { causa: 'Soporte' } } });
    expect(saved.gestionId).toBe('G2');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([expect.objectContaining({ gestionId: 'G2' })]);
  });

  it('sin sesión rechaza con "Sincronización no configurada" (como el throw síncrono de Angular)', async () => {
    localStorage.removeItem('pmo_token');
    const { adapter, fetchMock } = setup(jsonResponse({}));
    await expect(adapter.list()).rejects.toThrow('Sincronización no configurada');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
