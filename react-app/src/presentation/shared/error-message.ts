/** Texto del `message` de un error con forma de objeto (HttpError u otro); vacío si no lo trae. */
export const errorMessage = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '';

/** Mensaje del servidor (`error`/`message` del cuerpo, que PMO y Supabase devuelven tal cual) o `fallback`. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const body = typeof error === 'object' && error !== null && 'error' in error ? error.error : undefined;
  const fromBody =
    typeof body === 'string'
      ? body
      : typeof body === 'object' && body !== null
        ? ['error', 'message'].map((key) => (body as Record<string, unknown>)[key]).find((value) => typeof value === 'string')
        : undefined;
  const text = String(fromBody || errorMessage(error) || '').trim();
  return text && !/failed to fetch/i.test(text) ? text : fallback;
}
