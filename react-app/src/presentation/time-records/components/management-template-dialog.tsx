import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import {
  ADVANCED_TEMPLATE_FIELDS,
  isMissingAdvancedTemplateValue,
  type AdvancedTemplateFieldKey,
  type ManagementAdvancedTemplate,
} from '@domain/time-records/models/management-template.model';
import { ESTIMATED_HOURS_KEY, estimatedHoursOf } from '@application/time-records/template-values';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { AppSelect, type AppSelectOption } from '@presentation/shared/components/app-select';
import { DatePicker } from '@presentation/shared/components/date-picker';
import { useParameterOptions } from '../hooks/use-parameter-options';

const REQUIRED_MESSAGE = 'Campo obligatorio';

/** Campos visibles del formulario: todos menos `unity` (Módulo SAP), como `visibleTemplateFields` de Angular. */
const VISIBLE_FIELDS = ADVANCED_TEMPLATE_FIELDS.filter((field) => field.key !== 'unity');
const REQUIRED_FIELDS = ADVANCED_TEMPLATE_FIELDS.filter((field) => field.required);

type FormValues = Partial<Record<AdvancedTemplateFieldKey | typeof ESTIMATED_HOURS_KEY, string>>;
const ESTIMATED_HOURS_ID = 'template-horasEstimadas';
const ESTIMATED_HOURS_MESSAGE = 'Ingresa un número mayor o igual a 0';
const isInvalidEstimatedHours = (value: string | undefined) =>
  !!value?.trim() && estimatedHoursOf({ [ESTIMATED_HOURS_KEY]: value }) === null;

/** Los obligatorios no pueden quedar vacíos ni en `N/A`, `Sin valor`… (`isMissingAdvancedTemplateValue` del dominio). */
const templateSchema = z
  .object({
    ...Object.fromEntries(VISIBLE_FIELDS.map((field) => [field.key, z.string().optional()])),
    [ESTIMATED_HOURS_KEY]: z.string().optional(),
  })
  .superRefine((values: FormValues, ctx) => {
    if (isInvalidEstimatedHours(values[ESTIMATED_HOURS_KEY])) {
      ctx.addIssue({ code: 'custom', message: ESTIMATED_HOURS_MESSAGE, path: [ESTIMATED_HOURS_KEY] });
    }
    REQUIRED_FIELDS.forEach((field) => {
      if (isMissingAdvancedTemplateValue(values[field.key])) {
        ctx.addIssue({ code: 'custom', message: REQUIRED_MESSAGE, path: [field.key] });
      }
    });
  });

type SelectKey = Extract<
  AdvancedTemplateFieldKey,
  'tipoActividad' | 'causa' | 'complejidad' | 'impacto' | 'equipo' | 'modoActuacion' | 'lenguaje' | 'prefijo' | 'objetoRicef' | 'categoria'
>;

/** Opciones de un parámetro; los opcionales admiten "Sin valor" (`templateOptions` de Angular). */
function ParameterSelect({
  id,
  fieldKey,
  required,
  value,
  invalid,
  onChange,
}: {
  readonly id: string;
  readonly fieldKey: SelectKey;
  readonly required: boolean;
  readonly value: string;
  readonly invalid: boolean;
  readonly onChange: (value: string) => void;
}) {
  const parameterOptions = useParameterOptions(fieldKey);
  const options: AppSelectOption[] = required ? parameterOptions : [{ value: '', label: 'Sin valor' }, ...parameterOptions];
  return (
    <AppSelect
      id={id}
      options={options}
      value={value}
      onValueChange={onChange}
      aria-invalid={invalid}
      aria-describedby={invalid ? `${id}-error` : undefined}
    />
  );
}

interface TemplateFormProps {
  readonly template: ManagementAdvancedTemplate;
  readonly mode: 'create' | 'edit';
  readonly saving: boolean;
  readonly onSave: (template: ManagementAdvancedTemplate) => void;
  readonly onInvalid: (missing: string[]) => void;
  readonly onClose: () => void;
}

function TemplateForm({ template, mode, saving, onSave, onInvalid, onClose }: TemplateFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(templateSchema),
    // Angular muestra "Campo obligatorio" desde que se abre el diálogo, no solo tras tocar el campo.
    defaultValues: {
      ...Object.fromEntries(VISIBLE_FIELDS.map((field) => [field.key, template.values[field.key] || ''])),
      [ESTIMATED_HOURS_KEY]: String((template.values as Record<string, string | undefined>)[ESTIMATED_HOURS_KEY] ?? ''),
    },
    mode: 'onChange',
  });
  const { control, register, handleSubmit, formState } = form;
  const hoursError = formState.errors[ESTIMATED_HOURS_KEY]?.message;
  const values: FormValues = useWatch({ control });
  const missingKeys = new Set(REQUIRED_FIELDS.filter((field) => isMissingAdvancedTemplateValue(values[field.key])).map((f) => f.key));
  const requiredCompleted = REQUIRED_FIELDS.length - missingKeys.size;

  const submit = handleSubmit(
    (valid) => onSave({ ...template, values: { ...template.values, ...valid } }),
    () => onInvalid(REQUIRED_FIELDS.filter((field) => missingKeys.has(field.key)).map((field) => field.label)),
  );

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'Configurar gestión' : 'Editar configuración'}</DialogTitle>
        <DialogDescription>{template.gestionName}</DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[min(60svh,40rem)] flex-col gap-4 overflow-y-auto pr-1">
        <Alert role="status">
          <AlertDescription>
            Configura estos valores una vez. Se aplicarán automáticamente en futuros registros de esta gestión.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Campos de la plantilla</p>
          <p className="text-xs font-semibold text-primary">
            {requiredCompleted} de {REQUIRED_FIELDS.length} obligatorios
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {VISIBLE_FIELDS.map((field) => {
            const id = `template-${field.key}`;
            const invalid = missingKeys.has(field.key);
            return (
              <Field key={field.key} data-invalid={invalid}>
                <FieldLabel htmlFor={id}>
                  {field.label}
                  {field.required ? <span aria-hidden="true"> *</span> : null}
                </FieldLabel>
                {field.type === 'select' ? (
                  <Controller
                    control={control}
                    name={field.key}
                    render={({ field: bound }) => (
                      <ParameterSelect
                        id={id}
                        fieldKey={field.key as SelectKey}
                        required={field.required === true}
                        value={bound.value ?? ''}
                        invalid={invalid}
                        onChange={bound.onChange}
                      />
                    )}
                  />
                ) : field.type === 'date' ? (
                  <Controller
                    control={control}
                    name={field.key}
                    render={({ field: bound }) => <DatePicker id={id} value={bound.value ?? ''} onChange={bound.onChange} />}
                  />
                ) : (
                  <Input
                    id={id}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-error` : undefined}
                    {...register(field.key)}
                  />
                )}
                {invalid ? <FieldError id={`${id}-error`}>{REQUIRED_MESSAGE}</FieldError> : null}
              </Field>
            );
          })}
          <Field data-invalid={!!hoursError}>
            <FieldLabel htmlFor={ESTIMATED_HOURS_ID}>Horas estimadas</FieldLabel>
            <Input
              id={ESTIMATED_HOURS_ID}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-invalid={!!hoursError}
              aria-describedby={hoursError ? `${ESTIMATED_HOURS_ID}-error` : undefined}
              {...register(ESTIMATED_HOURS_KEY)}
            />
            {hoursError ? <FieldError id={`${ESTIMATED_HOURS_ID}-error`}>{hoursError}</FieldError> : null}
          </Field>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export interface ManagementTemplateDialogProps {
  /** Plantilla a configurar; `null` mantiene el diálogo cerrado. */
  readonly template: ManagementAdvancedTemplate | null;
  /** `create`: gestión sin plantilla; `edit`: plantilla incompleta (la usa el envío, F8). */
  readonly mode?: 'create' | 'edit';
  readonly saving: boolean;
  readonly onSave: (template: ManagementAdvancedTemplate) => void;
  /** Faltan campos obligatorios: etiquetas en el orden de la plantilla. */
  readonly onInvalid: (missing: string[]) => void;
  readonly onClose: () => void;
}

/**
 * Configuración obligatoria de campos avanzados por gestión (equivale a `ManagementTemplateDialogComponent`
 * + `ManagementTemplateFormComponent`).
 */
export function ManagementTemplateDialog({ template, mode = 'create', saving, onSave, onInvalid, onClose }: ManagementTemplateDialogProps) {
  return (
    <Dialog open={!!template} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        {template ? (
          <TemplateForm
            key={template.gestionId}
            template={template}
            mode={mode}
            saving={saving}
            onSave={onSave}
            onInvalid={onInvalid}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
