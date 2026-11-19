import type { WorkSettings } from '@domain/configuration/app-parameters.model';
import { testParameterFields } from '@/test/fakes/fake-app-parameters';
import { configurationSchema, toFormValues, toParameters } from './configuration-form';

const settings: WorkSettings = {
  mondayThursdayHours: 8.5,
  fridayHours: 8,
  dailyHours: { 0: 0, 1: 8.5, 2: 8.5, 3: 8.5, 4: 8.5, 5: 8, 6: 0 },
  maxDailyLaborHours: 10,
  maxHoursPerRecord: 16,
};

const values = () => toFormValues(testParameterFields(), settings);
const messages = (candidate: unknown) => {
  const result = configurationSchema.safeParse(candidate);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

describe('configurationSchema', () => {
  it('acepta la configuración por defecto, con 0 h en días no laborables', () => {
    expect(messages(values())).toEqual([]);
  });

  it('rechaza horas por día fuera de 0–24, vacías o no numéricas', () => {
    const base = values();
    expect(messages({ ...base, dailyHours: { ...base.dailyHours, 1: '25', 2: '-1', 3: '', 4: 'abc' } })).toEqual([
      'dailyHours.1: Usa un valor entre 0 y 24',
      'dailyHours.2: Usa un valor entre 0 y 24',
      'dailyHours.3: Usa un valor entre 0 y 24',
      'dailyHours.4: Usa un valor entre 0 y 24',
    ]);
  });

  it('los máximos deben ser mayores que 0 y hasta 24', () => {
    const base = values();
    expect(messages({ ...base, maxDailyLaborHours: '0', maxHoursPerRecord: '24.5' })).toEqual([
      'maxDailyLaborHours: Debe ser mayor que 0 y hasta 24 horas',
      'maxHoursPerRecord: Debe ser mayor que 0 y hasta 24 horas',
    ]);
    expect(messages({ ...base, maxDailyLaborHours: '24', maxHoursPerRecord: '0.5' })).toEqual([]);
  });
});

describe('toParameters', () => {
  it('convierte a números y deriva lunes-jueves y viernes de las horas por día', () => {
    const base = values();
    const { settings: result } = toParameters({ ...base, dailyHours: { ...base.dailyHours, 1: '9', 5: '7.5' }, maxHoursPerRecord: '12' });
    expect(result).toEqual({
      dailyHours: { 0: 0, 1: 9, 2: 8.5, 3: 8.5, 4: 8.5, 5: 7.5, 6: 0 },
      mondayThursdayHours: 9,
      fridayHours: 7.5,
      maxDailyLaborHours: 10,
      maxHoursPerRecord: 12,
    });
  });

  it('el orden de las opciones es el de la lista', () => {
    const base = values();
    const [first, ...rest] = base.fields;
    const reordered = { ...first, options: [...first.options].reverse() };
    const { fields } = toParameters({ ...base, fields: [reordered, ...rest] });
    expect(fields[0].options.map((option) => [option.value, option.sortOrder])).toEqual([
      ['No facturable', 0],
      ['Fábrica', 1],
      ['Laboral', 2],
    ]);
  });
});
