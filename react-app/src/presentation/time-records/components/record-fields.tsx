import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Fragment, useMemo, type ReactNode } from 'react';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import { Button } from '@/shared/ui/button';
import { FieldLabel } from '@/shared/ui/field';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { AppSelect, type AppSelectOption } from '@presentation/shared/components/app-select';
import { useManagementOptions } from '../hooks/use-select-options';
import { usePreview } from './preview-context';

export interface RecordFieldProps {
  readonly record: TimeRecord;
  readonly index: number;
  /** Con etiqueta visible (tarjetas); en la tabla el nombre accesible viene de `aria-label`. */
  readonly labelled?: boolean;
}

const withCurrentValue = (values: readonly string[], currentValue: string): string[] => {
  const unique = new Set(values.filter(Boolean));
  if (currentValue) unique.add(currentValue);
  return [...unique];
};

function FieldShell({
  labelled,
  id,
  label,
  children,
}: {
  readonly labelled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {labelled ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      {children}
    </div>
  );
}

export function ClienteSelect({ record, index, labelled }: RecordFieldProps) {
  const { clientes, locked, onClienteChange } = usePreview();
  const options = useMemo<AppSelectOption[]>(
    () => [
      { value: '', label: 'Seleccione un cliente' },
      ...withCurrentValue(clientes, record.cliente).map((cliente) => ({ value: cliente, label: cliente })),
    ],
    [clientes, record.cliente],
  );
  const id = `cliente-${index}`;
  return (
    <FieldShell labelled={labelled} id={id} label="Cliente">
      <AppSelect
        id={id}
        aria-label={labelled ? undefined : `Cliente del registro ${index + 1}`}
        options={options}
        value={record.cliente}
        onValueChange={(cliente) => onClienteChange(index, cliente)}
        placeholder="Seleccione un cliente"
        searchPlaceholder="Buscar cliente..."
        searchThreshold={0}
        disabled={locked}
      />
    </FieldShell>
  );
}

export function GestionSelect({ record, index, labelled }: RecordFieldProps) {
  const { locked, onGestionChange } = usePreview();
  const { data, isPending } = useManagementOptions(record.cliente, record.proyecto);
  const gestiones = data?.options;
  const currentValue = record.gestionId || record.solicitud;
  const options = useMemo<AppSelectOption[]>(() => {
    const values = (gestiones ?? []).map((item) => ({ value: item.id, label: item.name }));
    if (currentValue && !values.some((option) => option.value === currentValue)) {
      values.unshift({ value: currentValue, label: record.solicitud || currentValue });
    }
    return [{ value: '', label: 'Seleccione una gestión' }, ...values];
  }, [gestiones, currentValue, record.solicitud]);
  const id = `gestion-${index}`;
  return (
    <FieldShell labelled={labelled} id={id} label="Gestión Demanda">
      <AppSelect
        id={id}
        aria-label={labelled ? undefined : `Gestión Demanda del registro ${index + 1}`}
        options={options}
        value={currentValue}
        onValueChange={(gestionId) =>
          onGestionChange(index, record, gestiones?.find((item) => item.id === gestionId), gestionId)
        }
        placeholder="Seleccione una gestión"
        searchPlaceholder="Buscar gestión..."
        searchThreshold={0}
        loading={!!record.cliente && isPending}
        disabled={locked || !record.cliente}
      />
    </FieldShell>
  );
}

export function TipoHoraSelect({ record, index, labelled }: RecordFieldProps) {
  const { tipoHoraOptions, locked, onTipoHoraChange } = usePreview();
  const options = useMemo<AppSelectOption[]>(() => {
    const list = [...tipoHoraOptions];
    if (record.tipoHora && !list.some((option) => option.value === record.tipoHora)) {
      list.unshift({ value: record.tipoHora, label: record.tipoHora });
    }
    return [{ value: '', label: 'Seleccione tipo de hora' }, ...list];
  }, [tipoHoraOptions, record.tipoHora]);
  const id = `tipo-hora-${index}`;
  return (
    <FieldShell labelled={labelled} id={id} label="Tipo hora">
      <AppSelect
        id={id}
        aria-label={labelled ? undefined : `Tipo hora del registro ${index + 1}`}
        options={options}
        value={record.tipoHora}
        onValueChange={(tipoHora) => onTipoHoraChange(index, tipoHora)}
        placeholder="Seleccione tipo de hora"
        searchPlaceholder="Buscar tipo..."
        searchThreshold={0}
        disabled={locked}
      />
    </FieldShell>
  );
}

export function RecordActions({ index, compact = false }: { readonly index: number; readonly compact?: boolean }) {
  const { locked, onDuplicate, onEdit, onDelete } = usePreview();
  const label = (action: string) => `${action} registro ${index + 1}`;
  const actions = [
    { name: 'Duplicar', icon: Copy, variant: 'outline' as const, run: onDuplicate },
    { name: 'Editar', icon: Pencil, variant: 'outline' as const, run: onEdit },
    { name: 'Eliminar', icon: Trash2, variant: 'destructive' as const, run: onDelete },
  ];
  return (
    <div className={compact ? 'flex flex-nowrap items-center gap-1' : 'flex flex-wrap items-center gap-2'}>
      {actions.map(({ name, icon: Icon, variant, run }) => {
        const button = (
          <Button
            type="button"
            variant={variant}
            size={compact ? 'icon-sm' : 'sm'}
            disabled={locked}
            aria-label={label(name)}
            onClick={() => run(index)}
          >
            <Icon aria-hidden="true" />
            {compact ? null : name}
          </Button>
        );
        return compact ? (
          <Tooltip key={name}>
            <TooltipTrigger asChild>
              <span>{button}</span>
            </TooltipTrigger>
            <TooltipContent>{name}</TooltipContent>
          </Tooltip>
        ) : (
          <Fragment key={name}>{button}</Fragment>
        );
      })}
    </div>
  );
}

/** Funcional y RICEF del registro (solo si tienen valor), como la vista previa de Angular. */
export function RecordExtras({ record }: { readonly record: TimeRecord }) {
  if (!record.funcional && !record.ricef) return null;
  return (
    <div className="flex flex-col gap-0.5 text-xs font-medium text-primary">
      {record.funcional ? <p>Funcional: {record.funcional}</p> : null}
      {record.ricef ? <p>RICEF: {record.ricef}</p> : null}
    </div>
  );
}
