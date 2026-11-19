import { TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { useContainer } from '@presentation/providers/container-context';
import { DatePicker } from '@presentation/shared/components/date-picker';
import { TimeInput } from '@presentation/shared/components/time-input';
import { formatFechaEsp } from '@presentation/shared/format';
import { formatHours } from '../dashboard/dashboard-format';
import { sameDraftRecord } from '../drafts/draft-records';
import { useDrafts } from '../drafts/drafts-context';
import { dayLoad, intervalOf, reportToDraft } from './report-draft';
import type { ReportDay, ReportRow } from './report-list';
import { useDayLedger } from './use-my-reports';
import { useWorkdayPolicy } from './use-workday-policy';

export type DuplicateTarget =
  | { readonly kind: 'record'; readonly row: ReportRow }
  | { readonly kind: 'day'; readonly day: ReportDay };

const REPORTAR_PATH = '/registros/importar';

function DuplicateForm({ target, today, onClose }: { readonly target: DuplicateTarget; readonly today: string; readonly onClose: () => void }) {
  const { domainService: domain, parameters } = useContainer();
  const { records, addRecords, sendLocked } = useDrafts();
  const { ledger } = useDayLedger();
  const policy = useWorkdayPolicy();
  const navigate = useNavigate();
  const isDay = target.kind === 'day';
  const sourceRows = useMemo(() => (target.kind === 'day' ? target.day.rows : [target.row]), [target]);
  const [fecha, setFecha] = useState(today);
  const [horaIni, setHoraIni] = useState(isDay ? '' : target.row.start);
  const [horaFin, setHoraFin] = useState(isDay ? '' : target.row.end);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  /** Bloqueo síncrono: dos clics en el mismo ciclo de render no crean dos veces los borradores. */
  const submitting = useRef(false);

  const items = useMemo(() => {
    const defaultTipoHora = parameters.defaultFor('tipoHora');
    return sourceRows.map((row) => {
      const draft = reportToDraft(row, domain, defaultTipoHora, isDay ? { fecha } : { fecha, horaIni, horaFin });
      const interval = intervalOf(draft.horaIni, draft.horaFin);
      const computableHours = domain.isCountableHour(draft.tipoHora) ? Number(draft.horas || 0) : 0;
      return {
        row,
        draft,
        computableHours,
        overlaps: !!fecha && dayLoad(ledger, fecha, { interval, computableHours }).overlaps,
        alreadyDrafted: records.some((existing) => sameDraftRecord(existing, draft)),
        noSchedule: !draft.horaIni || !draft.horaFin,
      };
    });
  }, [sourceRows, parameters, domain, isDay, fecha, horaIni, horaFin, ledger, records]);

  const selected = items.filter((item) => !item.alreadyDrafted && !excluded.has(item.row.view.id));
  const addedHours = selected.reduce((sum, item) => sum + item.computableHours, 0);
  const targetTotal = fecha ? dayLoad(ledger, fecha, { interval: null, computableHours: addedHours }).totalHours : 0;
  const expected = fecha ? policy.expectedHoursForDate(fecha) : 0;
  const exceeds = !!fecha && selected.length > 0 && targetTotal > expected;
  const overlaps = selected.some((item) => item.overlaps);
  const sameDayAsSource = isDay && fecha === target.day.dayKey;
  const missingDate = !fecha;
  const blocked = sendLocked || missingDate || sameDayAsSource || selected.length === 0;
  const hasWarnings = overlaps || exceeds;

  const confirm = () => {
    if (submitting.current || blocked) return;
    submitting.current = true;
    if (!addRecords(selected.map((item) => item.draft))) {
      submitting.current = false;
      toast.error('Hay un envío en curso: no se agregaron borradores.');
      return;
    }
    toast.success(selected.length === 1 ? 'Registro duplicado en borradores.' : `${selected.length} registros duplicados en borradores.`, {
      action: { label: 'Ir a Reportar', onClick: () => void navigate(REPORTAR_PATH) },
    });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isDay ? `Duplicar el ${formatFechaEsp(target.day.dayKey)}` : 'Duplicar registro'}</DialogTitle>
        <DialogDescription>Crea borradores en Reportar con los datos del reporte; no se envían hasta que los registres.</DialogDescription>
      </DialogHeader>
      <div className="flex max-h-[min(60svh,34rem)] min-w-0 flex-col gap-4 overflow-y-auto">
        <Field>
          <FieldLabel htmlFor="duplicate-fecha">Fecha destino</FieldLabel>
          <DatePicker id="duplicate-fecha" value={fecha} onChange={setFecha} aria-invalid={sameDayAsSource || missingDate} />
          {sameDayAsSource ? <FieldDescription className="text-destructive">Elige una fecha distinta a la del día original.</FieldDescription> : null}
        </Field>
        {isDay ? (
          <fieldset className="flex min-w-0 flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">Registros a duplicar</legend>
            {items.map((item) => {
              const checked = !item.alreadyDrafted && !excluded.has(item.row.view.id);
              const meta = [item.row.start && item.row.end ? `${item.row.start}–${item.row.end}` : 'Sin horario'];
              return (
                <label key={item.row.view.id} className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm has-data-disabled:opacity-60">
                  <Checkbox
                    className="mt-0.5"
                    disabled={item.alreadyDrafted}
                    checked={checked}
                    onCheckedChange={(value) =>
                      setExcluded((current) => {
                        const next = new Set(current);
                        if (value === true) next.delete(item.row.view.id);
                        else next.add(item.row.view.id);
                        return next;
                      })
                    }
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{meta[0]}</span>
                      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatHours(item.row.hours, 2)} h{item.computableHours === 0 && item.row.hours > 0 ? ' · no computa' : ''}
                      </span>
                    </span>
                    <span className="truncate">{item.row.clientName} · {item.row.managementName}</span>
                    {item.alreadyDrafted || (item.overlaps && checked) ? (
                      <span className="flex flex-wrap gap-1.5 pt-0.5">
                        {item.alreadyDrafted ? <Badge variant="secondary">Ya está en borradores</Badge> : null}
                        {item.overlaps && checked ? <Badge variant="destructive">Solapa</Badge> : null}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="duplicate-hora-ini">Hora inicio</FieldLabel>
                <TimeInput id="duplicate-hora-ini" value={horaIni} onChange={setHoraIni} />
              </Field>
              <Field>
                <FieldLabel htmlFor="duplicate-hora-fin">Hora fin</FieldLabel>
                <TimeInput id="duplicate-hora-fin" value={horaFin} onChange={setHoraFin} />
              </Field>
            </div>
            {items[0]?.alreadyDrafted ? (
              <Alert role="status">
                <TriangleAlert aria-hidden="true" />
                <AlertDescription>Ya está en borradores: existe un borrador con la misma fecha, horario y datos.</AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
        {items.some((item) => item.noSchedule) ? (
          <Alert role="status">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              {isDay ? 'Algún reporte' : 'Este reporte'} no tiene horario: el borrador quedará sin horas y tendrás que completarlas en Reportar.
            </AlertDescription>
          </Alert>
        ) : null}
        {overlaps ? (
          <Alert role="status">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>Un horario se cruza con un reporte ya enviado ese día. Puedes crearlo de todos modos.</AlertDescription>
          </Alert>
        ) : null}
        {exceeds ? (
          <Alert role="status">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              El día destino quedaría en {formatHours(targetTotal, 2)} h computables y su jornada es de {formatHours(expected, 2)} h. Puedes crearlo de todos modos.
            </AlertDescription>
          </Alert>
        ) : null}
        {sendLocked ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>Hay un envío en curso: espera a que termine para agregar borradores.</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" disabled={blocked} onClick={confirm}>
          {hasWarnings ? 'Crear de todos modos' : selected.length > 1 ? `Crear ${selected.length} borradores` : 'Crear borrador'}
        </Button>
      </DialogFooter>
    </>
  );
}

export interface DuplicateDialogProps {
  readonly target: DuplicateTarget | null;
  /** Hoy en Colombia (`YYYY-MM-DD`), la fecha destino por defecto. */
  readonly today: string;
  readonly onClose: () => void;
}

/** Duplica un registro, o los de un día, a borradores de Reportar con avisos del libro mayor (nunca bloquean). */
export function DuplicateDialog({ target, today, onClose }: DuplicateDialogProps) {
  const key = !target ? '' : target.kind === 'record' ? target.row.view.id : `day-${target.day.dayKey}`;
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">{target ? <DuplicateForm key={key} target={target} today={today} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}
