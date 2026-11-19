import { HttpError } from './http-error';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type HttpParamValue = string | number | boolean;
export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  /** Parámetros de query (codificados como `HttpParams` de Angular), en el orden dado. */
  params?: Record<string, HttpParamValue>;
  /** Cuerpo: objetos/arrays/números/booleanos se serializan a JSON; strings, `FormData`, `Blob`… tal cual. */
  body?: unknown;
  /** Aborta la petición pasado este tiempo (error con `status` 0, como el `timeout` de Angular). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

const ACCEPT_HEADER_VALUE = 'application/json, text/plain, */*';
const XSSI_PREFIX = /^\)\]\}',?\n/;
const STANDARD_ENCODING_REPLACEMENTS: Record<string, string> = {
  '40': '@',
  '3A': ':',
  '24': '$',
  '2C': ',',
  '3B': ';',
  '3D': '=',
  '3F': '?',
  '2F': '/',
};

/** Codificación de `HttpUrlEncodingCodec` (Angular): `encodeURIComponent` conservando `@:$,;=?/`. */
function standardEncoding(value: string): string {
  return encodeURIComponent(value).replace(
    /%(\d[a-f0-9])/gi,
    (match, code: string) => STANDARD_ENCODING_REPLACEMENTS[code] ?? match,
  );
}

function urlWithParams(url: string, params?: Record<string, HttpParamValue>): string {
  const query = Object.entries(params ?? {})
    .map(([key, value]) => `${standardEncoding(key)}=${standardEncoding(String(value))}`)
    .join('&');
  if (!query) return url;
  const index = url.indexOf('?');
  const separator = index === -1 ? '?' : index < url.length - 1 ? '&' : '';
  return url + separator + query;
}

const isRawBody = (body: unknown): body is BodyInit =>
  typeof body === 'string' ||
  body instanceof Blob ||
  body instanceof FormData ||
  body instanceof URLSearchParams ||
  body instanceof ArrayBuffer;

function serializeBody(body: unknown): BodyInit | null {
  if (body === undefined || body === null) return null;
  if (isRawBody(body)) return body;
  return JSON.stringify(body);
}

/** `Content-Type` que Angular deduce del cuerpo cuando no se indica. */
function detectContentType(body: unknown): string | null {
  if (body === undefined || body === null || body instanceof FormData || body instanceof ArrayBuffer) {
    return null;
  }
  if (body instanceof Blob) return body.type || null;
  if (typeof body === 'string') return 'text/plain';
  if (body instanceof URLSearchParams) return 'application/x-www-form-urlencoded;charset=UTF-8';
  if (typeof body === 'object' || typeof body === 'number' || typeof body === 'boolean') {
    return 'application/json';
  }
  return null;
}

const hasHeader = (headers: Record<string, string>, name: string) =>
  Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());

/** Cuerpo JSON como lo parsea Angular (`responseType: 'json'`). */
function parseJson(text: string, status: number): unknown {
  const clean = text.replace(XSSI_PREFIX, '');
  if (clean === '') return null;
  try {
    return JSON.parse(clean);
  } catch (error) {
    if (status < 200 || status >= 300) return clean;
    throw error;
  }
}

/**
 * Cliente HTTP mínimo sobre `fetch`, equivalente al `HttpClient` de Angular (FetchBackend) en lo que usa
 * la app: JSON, cabeceras, query params y errores `HttpError` con la forma de `HttpErrorResponse`.
 * Sin interceptores: cada adaptador añade su cabecera `Authorization` (paridad con Angular).
 */
export class HttpClient {
  private readonly fetchFn: FetchFn;

  constructor(fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init)) {
    this.fetchFn = fetchFn;
  }

  get<T>(url: string, options: Omit<HttpRequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('GET', url, options);
  }

  delete<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', url, options);
  }

  post<T>(url: string, body: unknown, options: Omit<HttpRequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('POST', url, { ...options, body });
  }

  put<T>(url: string, body: unknown, options: Omit<HttpRequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('PUT', url, { ...options, body });
  }

  patch<T>(url: string, body: unknown, options: Omit<HttpRequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('PATCH', url, { ...options, body });
  }

  async request<T>(method: HttpMethod, url: string, options: HttpRequestOptions = {}): Promise<T> {
    const fullUrl = urlWithParams(url, options.params);
    const headers: Record<string, string> = { ...options.headers };
    if (!hasHeader(headers, 'Accept')) headers['Accept'] = ACCEPT_HEADER_VALUE;
    const contentType = detectContentType(options.body);
    if (contentType !== null && !hasHeader(headers, 'Content-Type')) headers['Content-Type'] = contentType;

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromCaller();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout =
      options.timeoutMs !== undefined
        ? setTimeout(
            () => controller.abort(new DOMException('signal timed out', 'TimeoutError')),
            options.timeoutMs,
          )
        : undefined;

    try {
      let response: Response;
      try {
        response = await this.fetchFn(fullUrl, {
          method,
          headers,
          body: serializeBody(options.body),
          signal: controller.signal,
        });
      } catch (error) {
        // Fallo de red, CORS, aborto o timeout: sin respuesta, status 0 (igual que Angular).
        const failure = error as { status?: number; statusText?: string } | null;
        throw new HttpError({
          error,
          status: failure?.status ?? 0,
          statusText: failure?.statusText,
          url: fullUrl,
        });
      }
      return await this.readResponse<T>(response, fullUrl);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private async readResponse<T>(response: Response, requestUrl: string): Promise<T> {
    const url = response.url || requestUrl;
    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      // Corte durante la lectura del cuerpo (Angular: HttpErrorResponse({ error }) sin más datos).
      throw new HttpError({ error });
    }

    let body: unknown;
    try {
      body = parseJson(text, response.status);
    } catch (error) {
      throw new HttpError({
        error,
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
        url,
      });
    }

    let status = response.status;
    if (status === 0) status = body ? 200 : 0;
    if (status >= 200 && status < 300) return body as T;
    throw new HttpError({
      error: body,
      headers: response.headers,
      status,
      statusText: response.statusText,
      url,
    });
  }
}
