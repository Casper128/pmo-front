import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { applyTemplateValues } from '@application/time-records/template-values';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Field, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { useContainer } from '@presentation/providers/container-context';
import { AppSelect, type AppSelectOption } from '@presentation/shared/components/app-select';
import { DatePicker } from '@presentation/shared/components/date-picker';
import { TimeInput } from '@presentation/shared/components/time-input';
import { queryKeys } from '@presentation/shared/query-keys';
import { recordErrors } from '../drafts/draft-records';
import { payloadFields } from '../drafts/template-rules';
import { useParameterOptions } from '../hooks/use-parameter-options';
import { useClientes, useManagementOptions } from '../hooks/use-select-options';

/**
 * Esquema del formulario de edición. Las reglas no se duplican: `superRefine` delega en el dominio
 * (`getMissingFields` + `getInvalidFields`), que es la misma fuente que usa la vista previa y el envío.
 */
function recordSchemaFor(domain: TimeRecordDomainService) {
  return z
    .object({
      fecha: z.string(),
      horaIni: z.string(),
      horaFin: z.string(),
      horas: z.string(),
      desc: z.string(),
      observacion: z.string(),
      cliente: z.string(),
      proyecto: z.string(),
      solicitud: z.string(),
      gestionId: z.string(),
      tipoHora: z.string(),
      funcional: z.string().optional(),
      ricef: z.string().optional(),
      duplicatedFromGestionId: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      recordErrors(domain, values).forEach((message) => ctx.addIssue({ code: 'custom', message, path: ['root'] }));
    });
}

/** Vista de solo lectura de los campos avanzados que se enviarán con la plantilla de la gestión. */
function PayloadPreview({ record }: { readonly record: TimeRecord }) {
  const { templates, apiBodyBuilder } = useContainer();
  const gestionId = (record.gestionId || record.solicitud || '').trim();
  const template = useQuery({
    queryKey: queryKeys.templates.detail(gestionId),
    queryFn: () => templates.get(gestionId),
    enabled: !!gestionId,
  });

  const preview = useMemo(() => {
    if (!gestionId) return { message: 'Selecciona una gestión para revisar los campos automáticos.' };
    if (template.isPending) return { message: 'Consultando configuración...' };
    if (template.isError) return { message: 'No fue posible consultar la plantilla de esta gestión.' };
    if (!template.data) {
      return { message: 'Esta gestión todavía no tiene plantilla de campos avanzados configurada.' };
    }
    try {
      return { fields: payloadFields(apiBodyBuilder.build(applyTemplateValues(record, template.data.values))) };
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : 'No fue posible construir la vista previa del envío.',
      };
    }
  }, [gestionId, template.isPending, template.isError, template.data, apiBodyBuilder, record]);

  return (
    <Collapsible defaultOpen className="rounded-lg border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex flex-col gap-0.5">
          <Badge variant="outline" className="w-fit">
            Solo lectura
          </Badge>
          <span className="text-sm font-semibold">Campos avanzados que se enviarán</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-3">
        {preview.fields ? (
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {preview.fields.map((field) => (
              <div key={field.label} className="rounded-md border bg-muted/40 px-3 py-2">
                <dt className="text-[11px] font-semibold text-muted-foreground">{field.label}</dt>
                <dd className="mt-0.5 text-sm font-semibold break-words">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Alert role="status">
            <AlertDescription>{preview.message}</AlertDescription>
          </Alert>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface EditRecordFormProps {
  readonly record: TimeRecord;
  readonly onSave: (edited: TimeRecord) => void;
  readonly onCancel: () => void;
}

function EditRecordForm({ record, onSave, onCancel }: EditRecordFormProps) {
  const { domainService: domain } = useContainer();
  const { clientes } = useClientes();
  const tipoHoraOptions = useParameterOptions('tipoHora');
  const schema = useMemo(() => recordSchemaFor(domain), [domain]);
  const form = useForm<TimeRecord>({
    resolver: zodResolver(schema),
    defaultValues: { ...record },
    mode: 'onChange',
  });
  const { control, register, setValue, getValues, handleSubmit } = form;
  const values = useWatch({ control }) as TimeRecord;
  const validationErrors = recordErrors(domain, values);

  const { data: gestiones, isPending: loadingGestiones } = useManagementOptions(values.cliente, values.proyecto);
  // Como Angular, al cargar las gestiones del cliente se fija el proyecto resuelto si el registro no lo tenía.
  useEffect(() => {
    if (gestiones && !getValues('proyecto')) setValue('proyecto', gestiones.project);
  }, [gestiones, getValues, setValue]);

  const set = (name: keyof TimeRecord, value: string | undefined) =>
    setValue(name, value as never, { shouldDirty: true, shouldValidate: true });

  /** `clearDuplicatedAdvancedFields`: al cambiar de gestión se descartan funcional y RICEF heredados. */
  const clearDuplicatedAdvancedFields = () => {
    if (!getValues('duplicatedFromGestionId')) return;
    set('funcional', '');
    set('ricef', '');
    set('duplicatedFromGestionId', undefined);
  };

  const changeCliente = (cliente: string) => {
    set('cliente', cliente);
    set('proyecto', '');
    set('solicitud', '');
    set('gestionId', '');
    clearDuplicatedAdvancedFields();
  };

  const changeGestion = (gestionId: string) => {
    const option = gestiones?.options.find((item) => item.id === gestionId);
    const duplicatedFrom = getValues('duplicatedFromGestionId');
    set('gestionId', gestionId);
    set('solicitud', option?.requestValue || option?.name || gestionId);
    if (duplicatedFrom && duplicatedFrom !== gestionId) clearDuplicatedAdvancedFields();
  };

  const changeTime = (name: 'horaIni' | 'horaFin', value: string) => {
    set(name, value);
    set('horas', domain.calcHoras(name === 'horaIni' ? value : getValues('horaIni'), name === 'horaFin' ? value : getValues('horaFin')) || '0');
  };

  const clienteOptions = useMemo<AppSelectOption[]>(() => {
    const unique = new Set(clientes.filter(Boolean));
    if (values.cliente) unique.add(values.cliente);
    return [{ value: '', label: 'Seleccione un cliente' }, ...[...unique].map((cliente) => ({ value: cliente, label: cliente }))];
  }, [clientes, values.cliente]);

  const currentGestion = values.gestionId || values.solicitud;
  const gestionOptions = useMemo<AppSelectOption[]>(() => {
    const list = (gestiones?.options ?? []).map((item) => ({ value: item.id, label: item.name }));
    if (values.solicitud && !list.some((item) => item.value === currentGestion)) {
      list.unshift({ value: currentGestion, label: values.solicitud });
    }
    return [{ value: '', label: 'Seleccione una gestión' }, ...list];
  }, [gestiones, currentGestion, values.solicitud]);

  const tipoOptions = useMemo<AppSelectOption[]>(() => {
    if (values.tipoHora && !tipoHoraOptions.some((option) => option.value === values.tipoHora)) {
      return [{ value: values.tipoHora, label: values.tipoHora }, ...tipoHoraOptions];
    }
    return [...tipoHoraOptions];
  }, [tipoHoraOptions, values.tipoHora]);

  return (
    <form noValidate onSubmit={handleSubmit((edited) => onSave({ ...edited }))} className="flex min-h-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Editar registro</DialogTitle>
        <DialogDescription>Ajusta solo lo necesario antes de enviar.</DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[min(60svh,40rem)] flex-col gap-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="edit-cliente">Cliente</FieldLabel>
            <AppSelect
              id="edit-cliente"
              options={clienteOptions}
              value={values.cliente}
              onValueChange={changeCliente}
              placeholder="Seleccione un cliente"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-gestion">Gestión Demanda</FieldLabel>
            <AppSelect
              id="edit-gestion"
              options={gestionOptions}
              value={currentGestion}
              onValueChange={changeGestion}
              placeholder="Seleccione una gestión"
              searchPlaceholder="Buscar gestión..."
              searchThreshold={0}
              loading={!!values.cliente && loadingGestiones}
              disabled={!values.cliente}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-tipo-hora">Tipo hora</FieldLabel>
            <AppSelect
              id="edit-tipo-hora"
              options={tipoOptions}
              value={values.tipoHora}
              onValueChange={(tipoHora) => set('tipoHora', tipoHora)}
              placeholder="Seleccione tipo de hora"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-fecha">Fecha</FieldLabel>
            <Controller
              control={control}
              name="fecha"
              render={({ field }) => <DatePicker id="edit-fecha" value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-hora-ini">Hora inicio</FieldLabel>
            <TimeInput id="edit-hora-ini" value={values.horaIni} onChange={(value) => changeTime('horaIni', value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-hora-fin">Hora fin</FieldLabel>
            <TimeInput id="edit-hora-fin" value={values.horaFin} onChange={(value) => changeTime('horaFin', value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-horas">Horas calculadas</FieldLabel>
            <Input id="edit-horas" readOnly value={`${values.horas} h`} className="font-semibold tabular-nums" />
          </Field>
        </div>

        {validationErrors.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>Revisa: {validationErrors.join(', ')}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="edit-desc">Descripción</FieldLabel>
            <Textarea id="edit-desc" rows={2} {...register('desc')} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-observacion">Observación</FieldLabel>
            <Textarea id="edit-observacion" rows={2} {...register('observacion')} />
          </Field>
        </div>

        <PayloadPreview record={values} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={validationErrors.length > 0}>
          Guardar cambios
        </Button>
      </DialogFooter>
    </form>
  );
}

export interface EditRecordDialogProps {
  /** Copia del borrador a editar; `null` mantiene el diálogo cerrado. */
  readonly record: TimeRecord | null;
  readonly onSave: (edited: TimeRecord) => void;
  readonly onCancel: () => void;
}

/** Edición rápida de un borrador (equivale a `EditRecordModalComponent`). */
export function EditRecordDialog({ record, onSave, onCancel }: EditRecordDialogProps) {
  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-3xl">
        {record ? <EditRecordForm record={record} onSave={onSave} onCancel={onCancel} /> : null}
      </DialogContent>
    </Dialog>
  );
}
