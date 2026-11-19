import { Info } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { WEEKDAYS, type ConfigurationFormValues } from './configuration-form';

const hoursInput = { type: 'number', inputMode: 'decimal', min: 0, max: 24, step: 0.5 } as const;

/** Jornada por día, límites de captura y nota sobre auditoría (que ahora se configura en el servidor). */
export function WorkRulesSection({ disabled }: { readonly disabled: boolean }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ConfigurationFormValues>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jornada, límites y auditoría</CardTitle>
        <CardDescription>
          Estos valores alimentan las validaciones, los indicadores diarios y el flujo de borrado de reportes enviados.{' '}
          {disabled ? 'Son de solo lectura para tu usuario.' : 'Como administrador puedes modificarlos.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="config-days-title" className="flex flex-col gap-3">
          <div>
            <h3 id="config-days-title" className="text-sm font-semibold">
              Horas esperadas por día
            </h3>
            <p className="text-xs text-muted-foreground">
              Define la jornada de cada día para que los pendientes y alertas se ajusten al calendario real. 0 h permite un día no laborable.
            </p>
          </div>
          <div className="flex max-w-sm flex-col gap-2">
            {WEEKDAYS.map((day) => {
              const id = `config-day-${day.index}`;
              const error = errors.dailyHours?.[String(day.index)]?.message;
              return (
                <Field key={day.index} orientation="horizontal" data-invalid={!!error} className="flex-wrap items-center justify-between">
                  <FieldLabel htmlFor={id} className="w-auto flex-none">
                    {day.label}
                  </FieldLabel>
                  <Input
                    id={id}
                    {...hoursInput}
                    className="h-10 w-28 text-right tabular-nums"
                    disabled={disabled}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    {...register(`dailyHours.${day.index}`)}
                  />
                  {error ? (
                    <FieldError id={`${id}-error`} className="basis-full text-right">
                      {error}
                    </FieldError>
                  ) : null}
                </Field>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="config-limits-title" className="flex flex-col gap-3">
            <div>
              <h3 id="config-limits-title" className="text-sm font-semibold">
                Límites de captura
              </h3>
              <p className="text-xs text-muted-foreground">Controlan el máximo computable diario y el tamaño permitido de cada registro.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['maxDailyLaborHours', 'Máximo computable por día'],
                  ['maxHoursPerRecord', 'Máximo por registro'],
                ] as const
              ).map(([name, label]) => {
                const error = errors[name]?.message;
                return (
                  <Field key={name} data-invalid={!!error}>
                    <FieldLabel htmlFor={`config-${name}`}>{label}</FieldLabel>
                    <Input
                      id={`config-${name}`}
                      {...hoursInput}
                      min={0.5}
                      className="h-10 tabular-nums"
                      disabled={disabled}
                      aria-invalid={!!error}
                      aria-describedby={error ? `config-${name}-error` : `config-${name}-hint`}
                      {...register(name)}
                    />
                    {error ? <FieldError id={`config-${name}-error`}>{error}</FieldError> : <FieldDescription id={`config-${name}-hint`}>Horas, hasta 24.</FieldDescription>}
                  </Field>
                );
              })}
            </div>
          </section>

          <Alert>
            <Info aria-hidden="true" />
            <AlertTitle>Auditoría y acceso técnico</AlertTitle>
            <AlertDescription>
              Los reportes enviados pasan por auditoría, salvo usuarios autorizados con clave técnica. El correo auditor y los correos con borrado técnico ahora se
              configuran en el servidor (<code>PMO_AUDIT_EMAIL</code> y <code>TECHNICAL_DELETE_EMAILS</code>) y no se editan desde esta pantalla.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
