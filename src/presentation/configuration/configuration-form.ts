import { z } from 'zod';
import type { AdvancedFieldConfiguration, AdvancedFieldKey, WorkSettings } from '@domain/configuration/app-parameters.model';

/** Días de la jornada en el orden de la pantalla (lunes a domingo); `index` es el de `Date#getDay`. */
export const WEEKDAYS = [
  { index: 1, label: 'Lunes' },
  { index: 2, label: 'Martes' },
  { index: 3, label: 'Miércoles' },
  { index: 4, label: 'Jueves' },
  { index: 5, label: 'Viernes' },
  { index: 6, label: 'Sábado' },
  { index: 0, label: 'Domingo' },
] as const;

/** Horas válidas: número finito hasta 24 (`isValidHourValue` de Angular); un campo vacío no es válido. */
function isValidHours(value: string, allowZero: boolean): boolean {
  const hours = Number(value);
  return value.trim() !== '' && Number.isFinite(hours) && hours <= 24 && (allowZero ? hours >= 0 : hours > 0);
}

const dailyHours = z.string().refine((value) => isValidHours(value, true), 'Usa un valor entre 0 y 24');
const limitHours = z.string().refine((value) => isValidHours(value, false), 'Debe ser mayor que 0 y hasta 24 horas');

export const configurationSchema = z.object({
  /** Horas esperadas por día, indexadas por `getDay` ('0'..'6'). */
  dailyHours: z.object(Object.fromEntries(WEEKDAYS.map((day) => [String(day.index), dailyHours]))),
  maxDailyLaborHours: limitHours,
  maxHoursPerRecord: limitHours,
  fields: z.array(
    z.object({
      key: z.custom<AdvancedFieldKey>(),
      label: z.string(),
      defaultValue: z.string(),
      options: z.array(z.object({ value: z.string(), label: z.string(), active: z.boolean(), sortOrder: z.number() })),
    }),
  ),
});

export type ConfigurationFormValues = z.infer<typeof configurationSchema>;

/** Estado de los parámetros → valores del formulario (los números viajan como texto de los `<input>`). */
export function toFormValues(fields: readonly AdvancedFieldConfiguration[], settings: WorkSettings): ConfigurationFormValues {
  return {
    dailyHours: Object.fromEntries(WEEKDAYS.map((day) => [String(day.index), String(settings.dailyHours[day.index] ?? '')])),
    maxDailyLaborHours: String(settings.maxDailyLaborHours),
    maxHoursPerRecord: String(settings.maxHoursPerRecord),
    fields: fields.map((field) => ({ ...field, options: field.options.map((option) => ({ ...option })) })),
  };
}

/** Valores validados → argumentos de `AppParametersFacade.save`; el orden de las opciones es el de la lista. */
export function toParameters(values: ConfigurationFormValues): { fields: AdvancedFieldConfiguration[]; settings: WorkSettings } {
  const hours = Object.fromEntries(WEEKDAYS.map((day) => [day.index, Number(values.dailyHours[String(day.index)])])) as Record<number, number>;
  return {
    fields: values.fields.map((field) => ({
      ...field,
      options: field.options.map((option, index) => ({ ...option, sortOrder: index })),
    })),
    settings: {
      dailyHours: hours,
      mondayThursdayHours: hours[1],
      fridayHours: hours[5],
      maxDailyLaborHours: Number(values.maxDailyLaborHours),
      maxHoursPerRecord: Number(values.maxHoursPerRecord),
    },
  };
}
