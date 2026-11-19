import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch, jsonResponse, requestAt } from '@/test/http';
import { HttpClient } from './http-client';
import { HttpError } from './http-error';

const URL_BASE = 'https://api.example.test/dev/recurso';

async function rejectionOf(promise: Promise<unknown>): Promise<HttpError> {
  try {
    await promise;
  } catch (error) {
    return error as HttpError;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('HttpClient', () => {
  afterEach(() => vi.useRealTimers());

  it('GET con éxito: añade Accept como Angular, codifica params como HttpParams y devuelve el JSON', async () => {
    const fetchMock = fakeFetch(jsonResponse({ ok: 1 }));
    const http = new HttpClient(fetchMock);

    const result = await http.get(URL_BASE, {
      headers: { Authorization: 'Bearer token-1' },
      params: { from: '2026-09-01', to: 'a b', email: 'persona@example.test', scope: 'own' },
    });

    expect(result).toEqual({ ok: 1 });
    expect(requestAt(fetchMock)).toEqual({
      url: `${URL_BASE}?from=2026-09-01&to=a%20b&email=persona@example.test&scope=own`,
      method: 'GET',
      headers: { Authorization: 'Bearer token-1', Accept: 'application/json, text/plain, */*' },
      body: null,
    });
  });

  it('POST serializa objetos a JSON y deduce Content-Type si no se indica', async () => {
    const fetchMock = fakeFetch(jsonResponse({ id: 'x' }), jsonResponse({}));
    const http = new HttpClient(fetchMock);

    await http.post(URL_BASE, { a: 1 });
    await http.post(URL_BASE, { a: 2 }, { headers: { 'content-type': 'application/json; v=1' } });

    expect(requestAt(fetchMock, 0)).toMatchObject({
      method: 'POST',
      headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json' },
      body: { a: 1 },
    });
    expect(requestAt(fetchMock, 1).headers).toEqual({
      'content-type': 'application/json; v=1',
      Accept: 'application/json, text/plain, */*',
    });
  });

  it('respuesta vacía (204) devuelve null', async () => {
    const http = new HttpClient(fakeFetch(new Response(null, { status: 204 })));
    await expect(http.delete(URL_BASE)).resolves.toBeNull();
  });

  it('error con cuerpo JSON: HttpError con la forma de HttpErrorResponse', async () => {
    const http = new HttpClient(fakeFetch(jsonResponse({ error: 'Gestión cerrada' }, 400, 'Bad Request')));

    const error = await rejectionOf(http.post(URL_BASE, {}));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).not.toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'HttpErrorResponse',
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      url: URL_BASE,
      message: `Http failure response for ${URL_BASE}: 400 Bad Request`,
      error: { error: 'Gestión cerrada' },
    });
  });

  it('error con cuerpo no JSON conserva el texto en error', async () => {
    const http = new HttpClient(fakeFetch(new Response('Internal', { status: 500, statusText: 'Server Error' })));
    await expect(http.get(URL_BASE)).rejects.toMatchObject({ status: 500, error: 'Internal' });
  });

  it('fallo de red: status 0, statusText "Unknown Error" y el error original de fetch', async () => {
    const networkError = new TypeError('Failed to fetch');
    const http = new HttpClient(fakeFetch(networkError));

    const error = await rejectionOf(http.post(URL_BASE, {}));

    expect(error).toMatchObject({
      status: 0,
      statusText: 'Unknown Error',
      url: URL_BASE,
      // Mismo texto que Angular FetchBackend (interpola el statusText original, ausente).
      message: `Http failure response for ${URL_BASE}: 0 undefined`,
    });
    expect(error.error).toBe(networkError);
  });

  it('401 y 403 se exponen en status (compatible con isSessionExpiredError)', async () => {
    const http = new HttpClient(
      fakeFetch(jsonResponse({ message: 'jwt expired' }, 401, 'Unauthorized'), jsonResponse({}, 403, 'Forbidden')),
    );
    await expect(http.get(URL_BASE)).rejects.toMatchObject({
      status: 401,
      error: { message: 'jwt expired' },
    });
    await expect(http.get(URL_BASE)).rejects.toMatchObject({ status: 403 });
  });

  it('JSON inválido en una respuesta 2xx: error de parseo con status 200', async () => {
    const http = new HttpClient(fakeFetch(new Response('{no-json', { status: 200 })));
    await expect(http.get(URL_BASE)).rejects.toMatchObject({
      status: 200,
      message: `Http failure during parsing for ${URL_BASE}`,
      error: expect.any(SyntaxError),
    });
  });

  it('timeoutMs aborta la petición y rechaza con status 0 y TimeoutError', async () => {
    vi.useFakeTimers();
    const fetchMock = fakeFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const http = new HttpClient(fetchMock);

    const pending = rejectionOf(http.get(URL_BASE, { timeoutMs: 1000 }));
    await vi.advanceTimersByTimeAsync(1000);
    const error = await pending;

    expect(error.status).toBe(0);
    expect((error.error as DOMException).name).toBe('TimeoutError');
  });
});
