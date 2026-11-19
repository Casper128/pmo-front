import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Field, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Skeleton } from '@/shared/ui/skeleton';
import { Textarea } from '@/shared/ui/textarea';
import type { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { useContainer } from '@presentation/providers/container-context';
import { AppSelect, type AppSelectOption } from '@presentation/shared/components/app-select';
import { DatePicker } from '@presentation/shared/components/date-picker';
import { TimeInput } from '@presentation/shared/components/time-input';
import { apiErrorMessage } from '@presentation/shared/error-message';
import { formatFechaEsp } from '@presentation/shared/format';
import { formatHours } from '../dashboard/dashboard-format';
import { useParameterOptions } from '../hooks/use-parameter-options';
import { buildReportEditBody, dayLoad, effectiveHours, intervalOf, reportEditErrors, type ReportEditValues } from './report-draft';
import type { ReportRow } from './report-list';
import { NO_DAY_KEY } from './report-view';
import type { ReportMode } from './use-report-filters';
import { useReportMutations } from './use-report-mutations';
import { useWorkdayPolicy } from './use-workday-policy';
import { useDayLedger } from './use-my-reports';

const editSchemaFor = (domain: TimeRecordDomainService) =>
  z
    .object({ fecha: z.string(), horaIni: z.string(), horaFin: z.string(), tipoHora: z.string(), horas: z.string(), descripcion: z.string() })
    .superRefine((values, ctx) => {
      reportEditErrors(domain, values).forEach((message) => ctx.addIssue({ code: 'custom', message, path: ['root'] }));
    });

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value || '—'}</dd>
    </div>
  );
}

function ReportDetail({ row, onEdit }: { readonly row: ReportRow; readonly onEdit: () => void }) {
  const { report } = row;
  const day = row.view.dayKey;
  return (
    <>
      <dl className="grid flex-1 content-start gap-3 overflow-y-auto px-4 pb-4 sm:grid-cols-2">
        <Detail label="Fecha" value={day === NO_DAY_KEY ? 'Sin fecha' : formatFechaEsp(day)} />
        <Detail label="Horario" value={row.start && row.end ? `${row.start}–${row.end}` : 'Sin horario'} />
        <Detail label="Horas" value={`${formatHours(row.hours, 2)} h`} />
        <Detail label="Tipo de hora" value={row.tipoHora} />
        <Detail label="Cliente" value={row.clientName} />
        <Detail label="Gestión" value={row.managementName} />
        <Detail label="Funcional" value={String(report.funcional || '')} />
        <Detail label="Módulo" value={String(report.modulo || '')} />
        <div className="sm:col-span-2">
          <Detail label="Descripción" value={row.description} />
        </div>
      </dl>
      <SheetFooter className="border-t sm:flex-row sm:justify-end">
        <Button type="button" onClick={onEdit}>
          Editar reporte
        </Button>
      </SheetFooter>
    </>
  );
}

function ReportEditForm({ row, onCancel, onSaved }: { readonly row: ReportRow; readonly onCancel: () => void; readonly onSaved: () => void }) {
  const { domainService: domain } = useContainer();
  const { update } = useReportMutations();
  const { ledger } = useDayLedger();
  const policy = useWorkdayPolicy();
  const tipoHoraOptions = useParameterOptions('tipoHora');
  const [serverError, setServerError] = useState('');
  const schema = useMemo(() => editSchemaFor(domain), [domain]);
  const form = useForm<ReportEditValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha: row.view.dayKey === NO_DAY_KEY ? '' : row.view.dayKey,
      horaIni: row.start,
      horaFin: row.end,
      tipoHora: row.tipoHora,
      horas: String(row.hours),
      descripcion: row.description,
    },
    mode: 'onChange',
  });
  const { control, register, setValue, getValues, handleSubmit } = form;
  const values = useWatch({ control }) as ReportEditValues;

  const hours = effectiveHours(domain, values);
  const computable = domain.isCountableHour(values.tipoHora);
  const load = dayLoad(
    ledger,
    values.fecha,
    { interval: intervalOf(values.horaIni, values.horaFin), computableHours: computable ? Number(hours || 0) : 0 },
    row.view,
  );
  const maxDaily = domain.getMaxDailyLaborHours();
  const expected = values.fecha ? policy.expectedHoursForDate(values.fecha) : 0;
  const errors = [
    ...reportEditErrors(domain, values),
    ...(load.overlaps ? ['El horario se cruza con otro reporte enviado ese día'] : []),
    ...(load.totalHours > maxDaily ? [`El total computable del día queda en ${formatHours(load.totalHours, 2)} h (máximo ${formatHours(maxDaily, 2)} h)`] : []),
  ];
  const exceedsWorkday = errors.length === 0 && load.totalHours > expected;

  const tipoOptions = useMemo<AppSelectOption[]>(
    () =>
      values.tipoHora && !tipoHoraOptions.some((option) => option.value === values.tipoHora)
        ? [{ value: values.tipoHora, label: values.tipoHora }, ...tipoHoraOptions]
        : [...tipoHoraOptions],
    [tipoHoraOptions, values.tipoHora],
  );

  const set = (name: keyof ReportEditValues, value: string) => setValue(name, value, { shouldDirty: true, shouldValidate: true });
  const changeTime = (name: 'horaIni' | 'horaFin', value: string) => {
    set(name, value);
    const start = name === 'horaIni' ? value : getValues('horaIni');
    const end = name === 'horaFin' ? value : getValues('horaFin');
    set('horas', domain.calcHoras(start, end) || '0');
  };

  const save = handleSubmit(async (edited) => {
    const saved = effectiveHours(domain, edited);
    if (saved === null || errors.length > 0) return;
    setServerError('');
    try {
      await update.mutateAsync({ identifier: row.view.id, body: buildReportEditBody(edited, saved) });
      toast.success('Reporte actualizado');
      onSaved();
    } catch (error) {
      setServerError(apiErrorMessage(error, 'No se pudo actualizar el reporte. Intenta nuevamente.'));
    }
  });

  return (
    <form noValidate onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        <Field>
          <FieldLabel htmlFor="report-fecha">Fecha</FieldLabel>
          <Controller control={control} name="fecha" render={({ field }) => <DatePicker id="report-fecha" value={field.value} onChange={field.onChange} />} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="report-hora-ini">Hora inicio</FieldLabel>
            <TimeInput id="report-hora-ini" value={values.horaIni} onChange={(value) => changeTime('horaIni', value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="report-hora-fin">Hora fin</FieldLabel>
            <TimeInput id="report-hora-fin" value={values.horaFin} onChange={(value) => changeTime('horaFin', value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="report-tipo-hora">Tipo de hora</FieldLabel>
            <AppSelect id="report-tipo-hora" options={tipoOptions} value={values.tipoHora} onValueChange={(value) => set('tipoHora', value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="report-horas">{computable ? 'Horas (calculadas)' : 'Horas (no computan)'}</FieldLabel>
            {computable ? (
              <Input id="report-horas" readOnly value={hours ? `${formatHours(Number(hours), 2)} h` : '—'} className="font-semibold tabular-nums" />
            ) : (
              <Input id="report-horas" inputMode="decimal" className="tabular-nums" {...register('horas')} aria-invalid={hours === null} />
            )}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="report-descripcion">Descripción</FieldLabel>
          <Textarea id="report-descripcion" rows={4} {...register('descripcion')} />
        </Field>

        {errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>{errors.join('. ')}</AlertDescription>
          </Alert>
        ) : null}
        {exceedsWorkday ? (
          <Alert role="status">
            <AlertDescription>
              El día quedaría en {formatHours(load.totalHours, 2)} h y la jornada es de {formatHours(expected, 2)} h. Puedes guardar de todos modos.
            </AlertDescription>
          </Alert>
        ) : null}
        {serverError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <SheetFooter className="border-t sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={update.isPending} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={update.isPending || errors.length > 0}>
          {update.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {exceedsWorkday ? 'Guardar de todos modos' : 'Guardar cambios'}
        </Button>
      </SheetFooter>
    </form>
  );
}

export interface ReportSheetProps {
  /** Id del reporte abierto (`?report=`); vacío mantiene el panel cerrado. */
  readonly reportId: string;
  readonly mode: ReportMode;
  readonly rows: readonly ReportRow[] | undefined;
  readonly onModeChange: (mode: ReportMode) => void;
  readonly onClose: () => void;
}

/** Detalle y edición de un reporte en un panel lateral; el modo y el reporte viven en la URL. */
export function ReportSheet({ reportId, mode, rows, onModeChange, onClose }: ReportSheetProps) {
  const row = rows?.find((item) => item.view.id === reportId);
  const editing = mode === 'edit' && !!row;
  return (
    <Sheet open={!!reportId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? 'Editar reporte' : 'Detalle del reporte'}</SheetTitle>
          <SheetDescription>{row ? `${row.view.id} · ${row.clientName} · ${row.managementName}` : reportId}</SheetDescription>
        </SheetHeader>
        {row ? (
          editing ? (
            <ReportEditForm key={row.view.id} row={row} onCancel={() => onModeChange('view')} onSaved={onClose} />
          ) : (
            <ReportDetail row={row} onEdit={() => onModeChange('edit')} />
          )
        ) : rows ? (
          <div className="px-4">
            <Alert role="status">
              <AlertDescription>No se encontró este reporte. Pudo eliminarse o estar fuera de tus reportes.</AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-4" role="status" aria-label="Cargando reporte...">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-24" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
