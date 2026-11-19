import { beforeEach, describe, expect, it } from 'vitest';
import type { TimeRecordApiBody } from '@domain/time-records/models/time-record-api.model';
import { fakeFetch, jsonResponse, requestAt, testEnvironment } from '@/test/http';
import { AuthService } from '../../auth/auth.service';
import { HttpClient } from '../../http/http-client';
import { TimeRecordHttpAdapter } from './time-record-http.adapter';

const API = testEnvironment.apiBaseUrl;
// Cabeceras finales que envía Angular (Authorization del adaptador + Accept/Content-Type de HttpClient).
const ANGULAR_HEADERS = {
  Authorization: 'Bearer token-1',
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
};

function setup(...responses: Parameters<typeof fakeFetch>) {
  const fetchMock = fakeFetch(...responses);
  const http = new HttpClient(fetchMock);
  const auth = new AuthService(http, testEnvironment);
  return { adapter: new TimeRecordHttpAdapter(http, auth, testEnvironment), fetchMock };
}

describe('TimeRecordHttpAdapter (paridad de peticiones con Angular)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pmo_token', 'token-1');
  });

  it('register: POST /tiemposConsultores/registrar con el cuerpo tal cual y Bearer', async () => {
    const body = { cliente: 'Cliente', solicitud: 'DO-1', HoraInicio: '2026-09-09T19:30:00' } as TimeRecordApiBody;
    const { adapter, fetchMock } = setup(jsonResponse({ status: 200, mensaje: 'Registrado' }));

    await expect(adapter.register(body)).resolves.toEqual({ status: 200, mensaje: 'Registrado' });
    expect(requestAt(fetchMock)).toEqual({
      url: `${API}/tiemposConsultores/registrar`,
      method: 'POST',
      headers: ANGULAR_HEADERS,
      body,
    });
  });

  it('register: propaga el HttpError del backend', async () => {
    const { adapter } = setup(jsonResponse({ message: 'Gestión cerrada' }, 400, 'Bad Request'));
    await expect(adapter.register({} as TimeRecordApiBody)).rejects.toMatchObject({
      status: 400,
      error: { message: 'Gestión cerrada' },
    });
  });

  it('getClientes / getProyectos: POST con cuerpo {} y mapeo de colecciones', async () => {
    const { adapter, fetchMock } = setup(
      jsonResponse({ clientes: [{ cliente: 'Cliente A' }, 'Cliente B', { nombre: '' }] }),
      jsonResponse([{ proyecto: 'Proyecto 1' }, { id: 22 }]),
    );

    await expect(adapter.getClientes()).resolves.toEqual(['Cliente A', 'Cliente B']);
    await expect(adapter.getProyectos('Cliente A/B')).resolves.toEqual(['Proyecto 1', '22']);
    expect(requestAt(fetchMock, 0)).toEqual({
      url: `${API}/tiemposConsultores/clientes`,
      method: 'POST',
      headers: ANGULAR_HEADERS,
      body: {},
    });
    expect(requestAt(fetchMock, 1).url).toBe(`${API}/tiemposConsultores/proyectos/Cliente%20A%2FB`);
  });

  it('getSolicitudOptions: query con encodeURIComponent y filtrado de opciones sin id/nombre', async () => {
    const { adapter, fetchMock } = setup(
      jsonResponse({ data: [{ idGestion: 10, nombreGestion: 'Soporte', solicitud: 'DO-10', cliente: 'Cliente A' }, {}] }),
    );

    const options = await adapter.getSolicitudOptions('Cliente A&B', 'Proyecto 1');

    expect(requestAt(fetchMock).url).toBe(
      `${API}/tiemposConsultores/solicitudes?cliente=Cliente%20A%26B&proyecto=Proyecto%201`,
    );
    expect(options).toEqual([
      expect.objectContaining({ id: '10', name: 'Soporte', requestValue: 'DO-10', client: 'Cliente A' }),
    ]);
  });

  it('las consultas de opciones devuelven [] si la API falla (catchError de Angular)', async () => {
    const { adapter } = setup(new TypeError('Failed to fetch'));
    await expect(adapter.getClientes()).resolves.toEqual([]);
    await expect(adapter.getProyectos('x')).resolves.toEqual([]);
    await expect(adapter.getSolicitudes('x', 'y')).resolves.toEqual([]);
  });

  it('sin token envía "Bearer null" como Angular', async () => {
    localStorage.clear();
    const { adapter, fetchMock } = setup(jsonResponse([]));
    await adapter.getClientes();
    expect(requestAt(fetchMock).headers['Authorization']).toBe('Bearer null');
  });
});
