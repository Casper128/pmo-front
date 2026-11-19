export interface HttpErrorInit {
  error?: unknown;
  headers?: Headers;
  status?: number;
  statusText?: string;
  url?: string | null;
}

/**
 * Error HTTP con la misma forma que `HttpErrorResponse` de Angular (FetchBackend): `status` (0 en fallo
 * de red o timeout), `statusText`, `url`, `ok`, `name`, `message` y `error` (cuerpo parseado, o el error
 * original de `fetch` si no hubo respuesta). Así siguen funcionando `isSessionExpiredError`,
 * `error?.error?.error`, `error?.error?.message` y el caso `status === 0`.
 *
 * Igual que `HttpErrorResponse`, no extiende `Error`: el código portado que hace
 * `error instanceof Error ? error.message : …` debe seguir eligiendo la rama del cuerpo.
 */
export class HttpError {
  readonly headers: Headers;
  readonly status: number;
  readonly statusText: string;
  readonly url: string | null;
  readonly ok = false;
  readonly name = 'HttpErrorResponse';
  readonly message: string;
  readonly error: unknown;

  constructor(init: HttpErrorInit) {
    this.headers = init.headers ?? new Headers();
    this.status = init.status !== undefined ? init.status : 0;
    this.statusText = init.statusText || 'Unknown Error';
    this.url = init.url || null;
    // Mismo texto que Angular (usa el statusText recibido, no el normalizado).
    this.message =
      this.status >= 200 && this.status < 300
        ? `Http failure during parsing for ${init.url || '(unknown url)'}`
        : `Http failure response for ${init.url || '(unknown url)'}: ${init.status} ${init.statusText}`;
    this.error = init.error || null;
  }
}

