import { describe, expect, it } from 'vitest';
import { TimeRecord } from '../models/time-record.model';
import type { TimeRecordParameters } from './time-record-domain.service';
import { TimeRecordApiBodyBuilder } from './time-record-api-body.builder';
import { TimeRecordValidationPolicy } from './time-record-validation.policy';

const parameters: TimeRecordParameters = {
  defaultFor: () => '',
  defaults: () => ({}) as ReturnType<TimeRecordParameters['defaults']>,
  workSettings: () => ({
    mondayThursdayHours: 9,
    fridayHours: 8,
    dailyHours: { 0: 0, 1: 9, 2: 9, 3: 9, 4: 9, 5: 8, 6: 0 },
    maxDailyLaborHours: 9,
    maxHoursPerRecord: 9,
  }),
};

function record(overrides: Partial<TimeRecord>): TimeRecord {
  return {
    fecha: '2026-09-09',
    horaIni: '07:30',
    horaFin: '12:30',
    horas: '5.0',
    desc: 'Actividad de prueba',
    observacion: '',
    cliente: 'Cliente A',
    proyecto: 'Proyecto A',
    solicitud: 'Gestión A',
    gestionId: 'G-1',
    tipoHora: 'Laboral',
    ...overrides,
  };
}

function dayIn(timeZone: string, label: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(label));
}

describe('TimeRecordApiBodyBuilder · fechaInicio', () => {
  const builder = new TimeRecordApiBodyBuilder(parameters);

  it('Fábrica de 19:30 a 23:59 conserva el día y las horas locales', () => {
    const body = builder.build(
      record({ horaIni: '19:30', horaFin: '23:59', horas: '4.5', tipoHora: 'Fabrica' }),
    );

    expect(body.tipoHora).toBe('Fabrica');
    expect(body.HoraInicio).toBe('2026-09-09T19:30:00.000Z');
    expect(body.HoraFin).toBe('2026-09-09T23:59:00.000Z');
    expect(body.fechaInicio).toBe('Wed Sep 09 2026 12:00:00 GMT-0500 (Colombia Standard Time)');
    expect(new Date(body.fechaInicio).toISOString().slice(0, 10)).toBe('2026-09-09');
    expect(dayIn('UTC', body.fechaInicio)).toBe('2026-09-09');
    expect(dayIn('America/Bogota', body.fechaInicio)).toBe('2026-09-09');
  });

  it.each([
    ['Fabrica', '2026-09-09', '18:30', '19:00', '0.5'],
    ['Laboral', '2026-09-09', '07:30', '12:30', '5.0'],
    ['Fabrica', '2026-09-09', '23:00', '23:59', '1.0'],
    ['Fabrica', '2026-09-30', '21:00', '23:00', '2.0'],
  ])('%s %s de %s a %s no cambia de día', (tipoHora, fecha, horaIni, horaFin, horas) => {
    const body = builder.build(record({ tipoHora, fecha, horaIni, horaFin, horas }));

    expect(body.HoraInicio).toBe(`${fecha}T${horaIni}:00.000Z`);
    expect(body.HoraFin).toBe(`${fecha}T${horaFin}:00.000Z`);
    expect(new Date(body.fechaInicio).toISOString().slice(0, 10)).toBe(fecha);
    expect(dayIn('UTC', body.fechaInicio)).toBe(fecha);
    expect(dayIn('America/Bogota', body.fechaInicio)).toBe(fecha);
  });
});

describe('TimeRecordValidationPolicy · Fábrica fuera de topes', () => {
  it('Fábrica de 4.5 h en un día con 9 h laborales no excede topes', () => {
    const policy = new TimeRecordValidationPolicy(parameters);
    const records = [
      record({ horaIni: '07:30', horaFin: '12:30', horas: '5.0' }),
      record({ horaIni: '13:30', horaFin: '17:30', horas: '4.0' }),
      record({ horaIni: '19:30', horaFin: '23:59', horas: '4.5', tipoHora: 'Fabrica' }),
    ];

    expect(policy.dailyHoursExceeded(records)).toEqual([]);
    expect(policy.recordHoursExceeded(records)).toEqual([]);
  });
});
