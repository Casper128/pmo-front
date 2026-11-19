import { vi } from 'vitest';
import type { Environment } from '@env/environment';

/** Entorno ficticio para tests de infraestructura (nunca apunta a servicios reales). */
export const testEnvironment: Environment = {
  production: false,
  apiBaseUrl: 'https://api.example.test/dev',
  supabaseUrl: 'https://project.supabase.example.test',
  supabasePublishableKey: 'test-publishable-key',
  configurationAdminEmails: ['admin@example.test'],
  locationAdminEmails: ['admin@example.test'],
};

/** Respuesta JSON simulada. */
export const jsonResponse = (body: unknown, status = 200, statusText = 'OK'): Response =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });

/** `fetch` simulado que devuelve las respuestas en orden (una función permite construirlas por petición). */
export function fakeFetch(
  ...responses: Array<Response | Error | ((url: string, init: RequestInit) => Response | Promise<Response>)>
) {
  let call = 0;
  return vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
    const next = responses[Math.min(call++, responses.length - 1)];
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(url, init);
    return next.clone();
  });
}

/** Petición registrada por un `fakeFetch`: URL, método, cabeceras y cuerpo JSON parseado. */
export function requestAt(fetchMock: ReturnType<typeof fakeFetch>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index];
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : init.body,
  };
}
