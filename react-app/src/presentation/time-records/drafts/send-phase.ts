import { useCallback, useRef, useState } from 'react';

/** Fases del envío masivo (plan §1.6). F7 solo usa `idle`; F8 añade las transiciones. */
export type SendPhase = 'idle' | 'sending' | 'saving-logs' | 'completed' | 'log-error' | 'failed';

/** Mientras dure el envío o falte confirmar el historial, los borradores no se modifican. */
export const isSendLocked = (phase: SendPhase): boolean =>
  phase === 'sending' || phase === 'saving-logs' || phase === 'log-error';

/** Un envío o una confirmación en curso: nunca se libera el bloqueo en este estado. */
const isSendActive = (phase: SendPhase): boolean => phase === 'sending' || phase === 'saving-logs';

/**
 * Fase del envío y bloqueo de edición. `isLocked()` lee la referencia (síncrono, para los mutadores);
 * `locked` es el valor reactivo para la interfaz. `reset` equivale a `resetSendTracking` de Angular.
 */
export function useSendPhase(initial: SendPhase) {
  const [phase, setPhase] = useState<SendPhase>(initial);
  const phaseRef = useRef<SendPhase>(initial);

  const reset = useCallback(() => {
    if (isSendActive(phaseRef.current)) return;
    phaseRef.current = 'idle';
    setPhase('idle');
  }, []);
  const isLocked = useCallback(() => isSendLocked(phaseRef.current), []);

  return { phase, locked: isSendLocked(phase), isLocked, reset };
}
