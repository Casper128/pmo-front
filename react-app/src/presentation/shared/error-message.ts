/** Texto del `message` de un error con forma de objeto (HttpError u otro); vacío si no lo trae. */
export const errorMessage = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '';
