/** Última gestión elegida por cliente: misma clave y formato (`{ [cliente]: gestionId }`) que Angular. */
export const LAST_MANAGEMENT_STORAGE_KEY = 'pmo_last_management_by_client';

function readMap(): Record<string, string> {
  const stored = localStorage.getItem(LAST_MANAGEMENT_STORAGE_KEY);
  return stored ? (JSON.parse(stored) as Record<string, string>) : {};
}

export function rememberedGestion(cliente: string): string {
  try {
    return readMap()[cliente] || '';
  } catch {
    localStorage.removeItem(LAST_MANAGEMENT_STORAGE_KEY);
    return '';
  }
}

export function rememberGestion(cliente: string, gestionId: string): void {
  if (!cliente || !gestionId) return;
  try {
    localStorage.setItem(LAST_MANAGEMENT_STORAGE_KEY, JSON.stringify({ ...readMap(), [cliente]: gestionId }));
  } catch {
    localStorage.removeItem(LAST_MANAGEMENT_STORAGE_KEY);
  }
}
