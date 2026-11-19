/** Borrador del textarea de importación: misma clave y formato (`{ rawText }`) que Angular. */
export const TEXT_DRAFT_STORAGE_KEY = 'pmo_text_time_draft';

export function readTextDraft(): string {
  try {
    const stored = localStorage.getItem(TEXT_DRAFT_STORAGE_KEY);
    if (!stored) return '';
    const parsed = JSON.parse(stored) as { rawText?: unknown } | null;
    return typeof parsed?.rawText === 'string' ? parsed.rawText : '';
  } catch {
    localStorage.removeItem(TEXT_DRAFT_STORAGE_KEY);
    return '';
  }
}

/** Texto vacío (o solo espacios) borra la clave. */
export function writeTextDraft(rawText: string): void {
  if (!rawText.trim()) {
    localStorage.removeItem(TEXT_DRAFT_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TEXT_DRAFT_STORAGE_KEY, JSON.stringify({ rawText }));
}
