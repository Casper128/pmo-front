import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { es } from 'react-day-picker/locale';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Calendar } from '@/shared/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { formatDateDisplay, parseDateValue, toDateValue, todayDateValue } from '@presentation/shared/format';
import { DEFAULT_MAX_DATE, DEFAULT_MIN_DATE, dateBounds } from './date-bounds';

export interface DatePickerProps {
  /** Fecha `YYYY-MM-DD`, o `''` sin fecha. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly id?: string;
  readonly min?: string;
  readonly max?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/**
 * Selector de fecha (equivale a `ui-date-input`): Shadcn `Calendar` (react-day-picker, locale es, semana
 * desde el lunes) en un `Popover`. Trabaja con strings `YYYY-MM-DD` y convierte con parseo/formato
 * explícitos en hora local, así el día emitido es el que el usuario pulsa en cualquier zona horaria.
 * Incluye "Hoy" y "Limpiar" como Angular.
 */
export function DatePicker({
  value,
  onChange,
  id,
  min = DEFAULT_MIN_DATE,
  max = DEFAULT_MAX_DATE,
  placeholder = 'Seleccionar fecha',
  disabled = false,
  className,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const display = formatDateDisplay(value);
  const bounds = dateBounds(min, max);
  const today = todayDateValue();

  const commit = (next: string) => {
    if (next && !bounds.isAllowed(next)) return;
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('w-full min-w-0 justify-between font-normal', className)}
          {...aria}
        >
          <span className={cn('truncate', !display && 'text-muted-foreground')}>{display || placeholder}</span>
          <CalendarIcon aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          required
          locale={es}
          selected={selected}
          defaultMonth={selected ?? parseDateValue(today)}
          disabled={bounds.disabled}
          startMonth={bounds.startMonth}
          endMonth={bounds.endMonth}
          onSelect={(date) => commit(toDateValue(date))}
        />
        <div className="grid grid-cols-2 gap-2 border-t p-2">
          <Button type="button" variant="outline" size="sm" disabled={!bounds.isAllowed(today)} onClick={() => commit(today)}>
            Hoy
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => commit('')}>
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
