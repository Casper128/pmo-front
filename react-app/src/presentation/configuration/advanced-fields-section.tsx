import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Field, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { AppSelect } from '@presentation/shared/components/app-select';
import { ConfirmDialog } from '@presentation/shared/components/confirm-dialog';
import type { ConfigurationFormValues } from './configuration-form';

const optionName = (option: { value: string; label: string } | undefined) => option?.label || option?.value || 'opción';

/** Opciones del campo `fieldIndex` (valor, texto, activo, orden). Quitar pide confirmación y ajusta el valor predeterminado. */
function OptionsEditor({ fieldIndex, disabled }: { readonly fieldIndex: number; readonly disabled: boolean }) {
  const { control, register, getValues, setValue } = useFormContext<ConfigurationFormValues>();
  const { fields, append, remove, move } = useFieldArray({ control, name: `fields.${fieldIndex}.options` });
  const [removal, setRemoval] = useState<number | null>(null);
  const options = useWatch({ control, name: `fields.${fieldIndex}.options` });

  const confirmRemoval = () => {
    if (removal === null) return;
    const removed = getValues(`fields.${fieldIndex}.options.${removal}`);
    remove(removal);
    if (getValues(`fields.${fieldIndex}.defaultValue`) === removed.value) {
      const next = getValues(`fields.${fieldIndex}.options`).find((option) => option.active)?.value ?? '';
      setValue(`fields.${fieldIndex}.defaultValue`, next, { shouldDirty: true });
    }
    setRemoval(null);
  };

  return (
    <>
      {fields.length ? (
        <ul className="max-h-[30rem] divide-y overflow-y-auto border-y" aria-label="Opciones del campo">
          {fields.map((item, index) => {
            const name = optionName(options?.[index]);
            return (
              <li key={item.id} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <Field>
                  <FieldLabel htmlFor={`option-value-${fieldIndex}-${index}`}>Valor interno</FieldLabel>
                  <Input id={`option-value-${fieldIndex}-${index}`} className="h-10" disabled={disabled} {...register(`fields.${fieldIndex}.options.${index}.value`)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`option-label-${fieldIndex}-${index}`}>Texto visible</FieldLabel>
                  <Input id={`option-label-${fieldIndex}-${index}`} className="h-10" disabled={disabled} {...register(`fields.${fieldIndex}.options.${index}.label`)} />
                </Field>
                <div className="flex items-center justify-between gap-1 md:justify-end">
                  <Controller
                    control={control}
                    name={`fields.${fieldIndex}.options.${index}.active`}
                    render={({ field }) => (
                      <Field orientation="horizontal" className="w-auto">
                        <Checkbox id={`option-active-${fieldIndex}-${index}`} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} disabled={disabled} />
                        <FieldLabel htmlFor={`option-active-${fieldIndex}-${index}`}>Activo</FieldLabel>
                      </Field>
                    )}
                  />
                  <div className="flex">
                    <Button type="button" variant="ghost" size="icon" className="size-10" disabled={disabled || index === 0} aria-label={`Subir ${name}`} onClick={() => move(index, index - 1)}>
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-10" disabled={disabled || index === fields.length - 1} aria-label={`Bajar ${name}`} onClick={() => move(index, index + 1)}>
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive" disabled={disabled} aria-label={`Eliminar ${name}`} onClick={() => setRemoval(index)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border-y p-6 text-center text-sm text-muted-foreground">Este campo no tiene opciones. Agrega la primera.</p>
      )}
      <div>
        <Button type="button" variant="outline" disabled={disabled} onClick={() => append({ value: '', label: '', active: true, sortOrder: fields.length })}>
          <Plus aria-hidden="true" /> Agregar opción
        </Button>
      </div>
      <ConfirmDialog
        open={removal !== null}
        title={`Eliminar ${optionName(removal === null ? undefined : options?.[removal])}`}
        description="Este cambio afectará los valores disponibles al guardar la configuración global."
        confirmLabel="Eliminar opción"
        destructive
        onConfirm={confirmRemoval}
        onClose={() => setRemoval(null)}
      />
    </>
  );
}

/** Campos avanzados: lista de campos (selector en móvil), valor predeterminado y opciones del campo elegido. */
export function AdvancedFieldsSection({ disabled }: { readonly disabled: boolean }) {
  const { control } = useFormContext<ConfigurationFormValues>();
  const fields = useWatch({ control, name: 'fields' });
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, fields.length - 1);
  const current = fields[index];

  const defaultOptions = [
    { value: '', label: 'Sin valor predeterminado' },
    ...(current?.options ?? []).filter((option) => option.active && option.value).map((option) => ({ value: option.value, label: option.label || option.value })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opciones y valores predeterminados globales</CardTitle>
        <CardDescription>
          Selecciona un campo para revisar sus opciones. {disabled ? 'Solo el administrador puede modificarlas.' : 'Los cambios se conservan al cambiar de campo.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <Field className="lg:hidden">
          <FieldLabel htmlFor="config-field-select">Campo que deseas configurar</FieldLabel>
          <AppSelect
            id="config-field-select"
            options={fields.map((field, position) => ({ value: String(position), label: `${field.label} · ${field.options.length} opciones` }))}
            value={String(index)}
            onValueChange={(value) => setSelected(Number(value))}
          />
        </Field>
        <nav aria-label="Campos configurables" className="hidden self-start lg:flex lg:flex-col lg:gap-1">
          {fields.map((field, position) => (
            <Button
              key={field.key}
              type="button"
              variant={position === index ? 'secondary' : 'ghost'}
              className={cn('h-9 justify-between', position === index && 'font-semibold')}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => setSelected(position)}
            >
              <span className="truncate">{field.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{field.options.length}</span>
            </Button>
          ))}
        </nav>

        {current ? (
          <article aria-label={`Opciones de ${current.label}`} className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-semibold">{current.label}</h3>
                <p className="text-xs text-muted-foreground">{current.options.length} opciones disponibles</p>
              </div>
              <Field className="sm:w-72">
                <FieldLabel htmlFor="config-default-value">Valor predeterminado</FieldLabel>
                <Controller
                  control={control}
                  name={`fields.${index}.defaultValue`}
                  render={({ field }) => (
                    <AppSelect id="config-default-value" options={defaultOptions} value={field.value} onValueChange={field.onChange} disabled={disabled} />
                  )}
                />
              </Field>
            </div>
            <OptionsEditor key={current.key} fieldIndex={index} disabled={disabled} />
          </article>
        ) : null}
      </CardContent>
    </Card>
  );
}
