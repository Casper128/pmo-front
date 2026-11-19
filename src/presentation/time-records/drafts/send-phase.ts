/** Fases del envío masivo (plan §1.6). */
export type SendPhase = 'idle' | 'sending' | 'saving-logs' | 'completed' | 'log-error' | 'failed';

/** Mientras dure el envío o falte confirmar el historial, los borradores no se modifican. */
export const isSendLocked = (phase: SendPhase): boolean =>
  phase === 'sending' || phase === 'saving-logs' || phase === 'log-error';

/** Un envío o una confirmación en curso: nunca se libera el bloqueo en este estado. */
export const isSendActive = (phase: SendPhase): boolean => phase === 'sending' || phase === 'saving-logs';

/** `sendProgressPercent` de Angular: limitado a 100 %. */
export const progressPercent = (processed: number, total: number): number =>
  total ? Math.min(100, Math.round((processed / total) * 100)) : 0;
