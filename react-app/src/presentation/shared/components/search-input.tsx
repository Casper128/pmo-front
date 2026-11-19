import { Search, X } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/shared/ui/input-group';

export interface SearchInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly id?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Nombre accesible si no hay un `<Label htmlFor>` asociado. */
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/**
 * Búsqueda (equivale a `ui-search-input`): Shadcn `InputGroup` con icono, botón "Limpiar búsqueda" cuando
 * hay texto y Escape para limpiar.
 */
export function SearchInput({
  value,
  onChange,
  id,
  placeholder = 'Buscar...',
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: SearchInputProps) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="search"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !value) return;
          event.preventDefault();
          onChange('');
        }}
      />
      {value && !disabled ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Limpiar búsqueda" onClick={() => onChange('')}>
            <X aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
