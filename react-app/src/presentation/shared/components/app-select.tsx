import { ChevronDownIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { normalizeSearch } from '@presentation/shared/format';
import { OverflowText } from './overflow-text';

export interface AppSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface AppSelectProps {
  readonly options: readonly AppSelectOption[];
  /** Valor seleccionado; `''` sin selección (muestra el placeholder). */
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly id?: string;
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  /** Texto cuando no hay opciones o la búsqueda no coincide. */
  readonly emptyMessage?: string;
  readonly disabled?: boolean;
  /** Deshabilita y muestra "Cargando..." si aún no hay selección (como `ui-select`). */
  readonly loading?: boolean;
  /** Con más opciones que este umbral se usa el combobox con búsqueda (`ui-select`: 8). */
  readonly searchThreshold?: number;
  /** Fuerza (`true`) o evita (`false`) la búsqueda, ignorando el umbral. */
  readonly searchable?: boolean;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

export const DEFAULT_SEARCH_THRESHOLD = 8;

/**
 * Radix `Select` trata `value=''` como "sin selección" y no admite `SelectItem value=''`. La opción cuyo
 * valor es `''` (p. ej. "Todos los días") viaja a Radix con este centinela y se mapea de ida y vuelta.
 */
const EMPTY_OPTION_SENTINEL = '__app-select-empty__';
const toRadixValue = (value: string) => (value === '' ? EMPTY_OPTION_SENTINEL : value);
const fromRadixValue = (value: string) => (value === EMPTY_OPTION_SENTINEL ? '' : value);

/** Filtro de cmdk con la normalización de `ui-select` (sin tildes ni mayúsculas, "contiene"). */
const filterByLabel = (_value: string, search: string, keywords: string[] = []) =>
  normalizeSearch(keywords.join(' ')).includes(normalizeSearch(search)) ? 1 : 0;

/**
 * Selector (equivale a `ui-select`): Shadcn `Select` con pocas opciones y combobox `Popover` + `Command`
 * con búsqueda cuando superan `searchThreshold`. Misma API: `options`, `placeholder`, `loading`,
 * `searchThreshold`; el label, la ayuda y el error se componen fuera con `Field`.
 */
export function AppSelect({
  options,
  value,
  onValueChange,
  id,
  placeholder = 'Seleccione una opción',
  searchPlaceholder = 'Buscar opción...',
  emptyMessage = 'No hay opciones que coincidan.',
  disabled = false,
  loading = false,
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
  searchable,
  className,
  ...aria
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const isDisabled = disabled || loading;
  const selected = options.find((option) => option.value === value);
  const triggerText = loading && !selected ? 'Cargando...' : selected?.label || placeholder;
  const withSearch = searchable ?? options.length > searchThreshold;
  const indicator = loading ? (
    <Loader2 aria-hidden="true" className="animate-spin text-muted-foreground" />
  ) : (
    <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
  );

  if (!withSearch) {
    return (
      <Select
        value={selected ? toRadixValue(selected.value) : ''}
        onValueChange={(next) => onValueChange(fromRadixValue(next))}
        disabled={isDisabled}
      >
        <SelectTrigger id={id} className={cn('w-full min-w-0', className)} aria-busy={loading || undefined} {...aria}>
          <SelectValue placeholder={triggerText}>
            <OverflowText className="pointer-events-auto">{triggerText}</OverflowText>
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper">
          {options.length ? (
            options.map((option) => (
              <SelectItem key={option.value} value={toRadixValue(option.value)} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          )}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-busy={loading || undefined}
          disabled={isDisabled}
          className={cn('w-full min-w-0 justify-between font-normal', className)}
          {...aria}
        >
          <OverflowText className={cn(!selected && 'text-muted-foreground')}>{triggerText}</OverflowText>
          {indicator}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={`Opciones de ${aria['aria-label'] ?? placeholder}`}
        className="w-(--radix-popover-trigger-width) min-w-72 p-0"
      >
        {/* `label` de cmdk da el nombre accesible al input (cmdk lo enlaza con aria-labelledby). */}
        <Command filter={filterByLabel} label="Buscar opción">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  disabled={option.disabled}
                  data-checked={option.value === value}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  {/* CommandItem de Shadcn ya dibuja el check cuando data-checked es true. */}
                  <span className="min-w-0 flex-1 break-words">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
