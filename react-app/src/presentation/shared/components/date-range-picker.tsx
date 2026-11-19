import { CalendarRange } from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Calendar } from '@/shared/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { formatDateDisplay, parseDateValue, toDateValue, todayDateValue } from '@presentation/shared/format';
import { DEFAULT_MAX_DATE, DEFAULT_MIN_DATE, dateBounds } from './date-bounds';

/** Rango de fechas `YYYY-MM-DD`; `''` en el extremo que falte. */
export interface DateRangeValue {
  readonly from: string;
  readonly to: string;
}

export interface DateRangePickerProps {
  readonly value: DateRangeValue;
  readonly onChange: (value: DateRangeValue) => void;
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

const EMPTY_RANGE: DateRangeValue = { from: '', to: '' };

/**
 * Selector de rango (reportes): Shadcn `Calendar mode="range"` en un `Popover`. Emite strings `YYYY-MM-DD`
 * con el día local en cada pulsación (el primer clic fija desde = hasta, como react-day-picker); el popover
 * queda abierto para completar el rango y se cierra al pulsar fuera o con "Limpiar".
 */
export function DateRangePicker({
  value,
  onChange,
  id,
  min = DEFAULT_MIN_DATE,
  max = DEFAULT_MAX_DATE,
  placeholder = 'Seleccionar rango',
  disabled = false,
  className,
  ...aria
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const from = parseDateValue(value.from);
  const to = parseDateValue(value.to);
  const bounds = dateBounds(min, max);
  const fromLabel = formatDateDisplay(value.from);
  const toLabel = formatDateDisplay(value.to);
  const display = fromLabel ? `${fromLabel} – ${toLabel || '…'}` : '';

  const select = (range: DateRange | undefined) =>
    onChange({
      from: range?.from ? toDateValue(range.from) : '',
      to: range?.to ? toDateValue(range.to) : '',
    });

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
          <CalendarRange aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          locale={es}
          selected={from ? { from, to } : undefined}
          defaultMonth={from ?? parseDateValue(todayDateValue())}
          disabled={bounds.disabled}
          startMonth={bounds.startMonth}
          endMonth={bounds.endMonth}
          onSelect={select}
        />
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              onChange(EMPTY_RANGE);
              setOpen(false);
            }}
          >
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
