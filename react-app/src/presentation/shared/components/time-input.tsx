import type { ComponentProps } from 'react';
import { cn } from 'cn';
import { Input } from '@/shared/ui/input';
import { normalizeTime } from '@presentation/shared/format';

export interface TimeInputProps extends Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> {
  /** Hora `HH:mm` (también acepta `H:mm` o `HH:mm:ss`, que se normalizan); `''` sin hora. */
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/**
 * Hora (equivale a `ui-time-input`): `Input type="time"` nativo de Shadcn con paso de 1 minuto (decisión P5).
 * Emite `HH:mm` o `''` al borrar.
 */
export function TimeInput({ value, onChange, className, step = 60, ...props }: TimeInputProps) {
  return (
    <Input
      type="time"
      step={step}
      value={normalizeTime(value)}
      onChange={(event) => onChange(normalizeTime(event.target.value))}
      className={cn('tabular-nums', className)}
      {...props}
    />
  );
}
