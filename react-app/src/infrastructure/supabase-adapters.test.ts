import { beforeEach, describe, expect, it } from 'vitest';
import { fakeFetch, jsonResponse, requestAt, testEnvironment } from '@/test/http';
import { SupabaseUserAuditAdapter } from './audit/supabase-user-audit.adapter';
import { AuthService } from './auth/auth.service';
import { HttpClient } from './http/http-client';
import { ManagementDeleteRequestAdapter } from './time-records/adapters/management-delete-request.adapter';
import { SupabaseSendLogAdapter } from './time-records/adapters/supabase-send-log.adapter';
import { TimeManagementHttpAdapter } from './time-records/adapters/time-management-http.adapter';

const FUNCTIONS = `${testEnvironment.supabaseUrl}/functions/v1`;
const ACCEPT = 'application/json, text/plain, */*';
const SUPABASE_HEADERS = {
  apikey: testEnvironment.supabasePublishableKey,
  Authorization: 'Bearer token-1',
  'Content-Type': 'application/json',
  Accept: ACCEPT,
};

function setup(...responses: Parameters<typeof fakeFetch>) {
  const fetchMock = fakeFetch(...responses);
  const http = new HttpClient(fetchMock);
  const auth = new AuthService(http, testEnvironment);
  return { http, auth, fetchMock };
}

describe('Adaptadores Supabase y de gestión (paridad de peticiones con Angular)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pmo_token', 'token-1');
  });

  it('SupabaseSendLogAdapter.list: GET con params from/to/scope y mapeo de filas', async () => {
    const { http, auth, fetchMock } = setup(
      jsonResponse({
        logs: [
          {
            id: '1',
            user_key: 'k',
            user_email: 'persona@example.test',
            item_index: 0,
            successful: false,
            reference: 'DO-1',
            error_message: null,
            occurred_at: '2026-09-09T10:00:00Z',
            week_start: '2026-09-07',
            week_end: '2026-09-13',
            expires_at: '2026-12-08',
          },
        ],
      }),
    );
    const adapter = new SupabaseSendLogAdapter(http, auth, testEnvironment);

    const result = await adapter.list({ dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(requestAt(fetchMock)).toEqual({
      url: `${FUNCTIONS}/pmo-send-logs?from=2026-09-01&to=2026-09-30&scope=own`,
      method: 'GET',
      headers: SUPABASE_HEADERS,
      body: null,
    });
    expect(result).toEqual({
      logs: [expect.objectContaining({ userEmail: 'persona@example.test', errorMessage: '', itemIndex: 0 })],
      isAdmin: false,
      retentionDays: 90,
    });
  });

  it('SupabaseSendLogAdapter.createMany: POST { logs }', async () => {
    const { http, auth, fetchMock } = setup(jsonResponse({}));
    await new SupabaseSendLogAdapter(http, auth, testEnvironment).createMany([
      { itemIndex: 0, successful: true, reference: 'DO-1' },
    ]);
    expect(requestAt(fetchMock)).toEqual({
      url: `${FUNCTIONS}/pmo-send-logs`,
      method: 'POST',
      headers: SUPABASE_HEADERS,
      body: { logs: [{ itemIndex: 0, successful: true, reference: 'DO-1' }] },
    });
  });

  it('TimeManagementHttpAdapter: list a la API PMO y update a pmo-management-edit con apikey', async () => {
    const { http, auth, fetchMock } = setup(jsonResponse({ data: { rows: [{ identificador: 'R1' }, 3] } }), jsonResponse(null));
    const adapter = new TimeManagementHttpAdapter(http, auth, testEnvironment);

    await expect(adapter.list(7)).resolves.toEqual([{ identificador: 'R1' }]);
    await adapter.update('R1', { horas: '2' });

    expect(requestAt(fetchMock, 0)).toEqual({
      url: `${testEnvironment.apiBaseUrl}/tiemposConsultores/gestion`,
      method: 'POST',
      headers: { Authorization: 'Bearer token-1', Accept: ACCEPT, 'Content-Type': 'application/json' },
      body: { idConsultor: 7 },
    });
    expect(requestAt(fetchMock, 1)).toEqual({
      url: `${FUNCTIONS}/pmo-management-edit`,
      method: 'POST',
      headers: { Authorization: 'Bearer token-1', apikey: testEnvironment.supabasePublishableKey, 'Content-Type': 'application/json', Accept: ACCEPT },
      body: { identifier: 'R1', changes: { horas: '2' } },
    });
  });

  it('ManagementDeleteRequestAdapter.approve: PATCH con deleteReport y mapeo de la fila', async () => {
    const { http, auth, fetchMock } = setup(
      jsonResponse({ request: { id: 5, identifier: 'R1', status: 'approved', review_note: '  ' } }),
    );
    const result = await new ManagementDeleteRequestAdapter(http, auth, testEnvironment).approve('5');
    expect(requestAt(fetchMock)).toEqual({
      url: `${FUNCTIONS}/pmo-management-delete-request`,
      method: 'PATCH',
      headers: SUPABASE_HEADERS,
      body: { id: '5', status: 'approved', deleteReport: true },
    });
    expect(result).toMatchObject({ id: '5', identifier: 'R1', status: 'approved', reviewNote: undefined, report: {} });
  });

  it('ManagementDeleteRequestAdapter.reject: PATCH con la nota recortada (o sin ella)', async () => {
    const { http, auth, fetchMock } = setup(jsonResponse({ request: { id: '6', status: 'rejected' } }));
    const adapter = new ManagementDeleteRequestAdapter(http, auth, testEnvironment);
    await adapter.reject('6', '  Falta soporte ');
    await adapter.reject('6', '   ');
    expect(requestAt(fetchMock, 0).body).toEqual({ id: '6', status: 'rejected', reviewNote: 'Falta soporte' });
    expect(requestAt(fetchMock, 1).body).toEqual({ id: '6', status: 'rejected' });
  });

  it('ManagementDeleteRequestAdapter.listMine: GET con scope=mine y mapeo de filas', async () => {
    const { http, auth, fetchMock } = setup(
      jsonResponse({ requests: [{ id: '7', identifier: 'R2', status: 'rejected', review_note: 'Falta soporte' }] }),
    );

    const result = await new ManagementDeleteRequestAdapter(http, auth, testEnvironment).listMine();

    expect(requestAt(fetchMock)).toEqual({
      url: `${FUNCTIONS}/pmo-management-delete-request?scope=mine`,
      method: 'GET',
      headers: SUPABASE_HEADERS,
      body: null,
    });
    expect(result).toMatchObject([{ id: '7', identifier: 'R2', status: 'rejected', reviewNote: 'Falta soporte' }]);
  });

  it('TimeManagementHttpAdapter.requestDelete: devuelve duplicated según la respuesta', async () => {
    const { http, auth } = setup(jsonResponse({ request: {}, duplicated: true }), jsonResponse({ request: {} }));
    const adapter = new TimeManagementHttpAdapter(http, auth, testEnvironment);
    const body = { identifier: 'R1', auditorEmail: 'auditor@example.test', report: {} };

    expect(await adapter.requestDelete(body)).toEqual({ duplicated: true });
    expect(await adapter.requestDelete(body)).toEqual({ duplicated: false });
  });

  it('SupabaseUserAuditAdapter.recordTimeReport: POST con eventType time_report', async () => {
    const { http, auth, fetchMock } = setup(jsonResponse({}));
    const location = { latitude: 4.6, longitude: -74.1, accuracy: 20, locationStatus: 'granted' as const };
    await new SupabaseUserAuditAdapter(http, auth, testEnvironment).recordTimeReport(
      location,
      { reference: 'DO-1', customer: 'Cliente', date: '2026-09-09' },
      true,
    );
    expect(requestAt(fetchMock)).toEqual({
      url: `${FUNCTIONS}/pmo-user-audit`,
      method: 'POST',
      headers: SUPABASE_HEADERS,
      body: {
        ...location,
        eventType: 'time_report',
        successful: true,
        report: { reference: 'DO-1', customer: 'Cliente', date: '2026-09-09' },
      },
    });
  });
});
