import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { FakeAppParameters } from '@/test/fakes/fake-app-parameters';
import { makeDraft } from '@/test/fakes/drafts-fixtures';
import {
  applyClienteChange,
  applyGestionChange,
  applyImportDefaults,
  findLastMatchingRecordIndex,
  markDuplicatedRecord,
  minutesOf,
  preferredGestion,
  recordErrors,
  recordSaveErrors,
  sortRecords,
} from './draft-records';

const domain = new TimeRecordDomainService(new FakeAppParameters());

describe('registros borrador (funciones puras)', () => {
  it('minutesOf devuelve 0 para horas inválidas', () => {
    expect(minutesOf('07:30')).toBe(450);
    expect(minutesOf('')).toBe(0);
    expect(minutesOf('abc')).toBe(0);
  });

  it('sortRecords ordena por fecha, hora de inicio y hora de fin sin mutar la entrada', () => {
    const a = makeDraft({ fecha: '2026-09-10', horaIni: '08:00', horaFin: '09:00' });
    const b = makeDraft({ fecha: '2026-09-09', horaIni: '10:00', horaFin: '11:00' });
    const c = makeDraft({ fecha: '2026-09-09', horaIni: '08:00', horaFin: '12:00' });
    const d = makeDraft({ fecha: '2026-09-09', horaIni: '08:00', horaFin: '09:00' });
    const input = [a, b, c, d];
    expect(sortRecords(input)).toEqual([d, c, b, a]);
    expect(input).toEqual([a, b, c, d]);
  });

  it('applyImportDefaults usa el tipo de hora configurado y, si falta, Laboral', () => {
    expect(applyImportDefaults(makeDraft({ tipoHora: '' }), 'Fábrica').tipoHora).toBe('Fábrica');
    expect(applyImportDefaults(makeDraft({ tipoHora: '' }), '').tipoHora).toBe('Laboral');
    expect(applyImportDefaults(makeDraft({ tipoHora: 'No facturable' }), 'Fábrica').tipoHora).toBe('No facturable');
  });

  it('markDuplicatedRecord recuerda la gestión de origen', () => {
    expect(markDuplicatedRecord(makeDraft({ gestionId: 'G-1' })).duplicatedFromGestionId).toBe('G-1');
    expect(markDuplicatedRecord(makeDraft({ gestionId: '', solicitud: 'Gestión Uno' })).duplicatedFromGestionId).toBe(
      'Gestión Uno',
    );
  });

  it('findLastMatchingRecordIndex devuelve la última coincidencia o -1', () => {
    const base = makeDraft();
    expect(findLastMatchingRecordIndex([base, makeDraft({ desc: 'otra' }), { ...base }], base)).toBe(2);
    expect(findLastMatchingRecordIndex([makeDraft({ desc: 'otra' })], base)).toBe(-1);
  });

  it('applyClienteChange reinicia proyecto y gestión y descarta lo heredado de un duplicado', () => {
    const duplicated = makeDraft({ funcional: 'F', ricef: 'R', duplicatedFromGestionId: 'G-1' });
    expect(applyClienteChange(duplicated, 'Cliente Beta')).toMatchObject({
      cliente: 'Cliente Beta',
      proyecto: '',
      solicitud: '',
      gestionId: '',
      funcional: '',
      ricef: '',
      duplicatedFromGestionId: undefined,
    });
    expect(applyClienteChange(makeDraft({ funcional: 'F' }), 'Cliente Beta').funcional).toBe('F');
  });

  it('applyGestionChange toma solicitud y proyecto de la opción y limpia lo heredado si cambia la gestión', () => {
    const option = { id: 'G-2', name: 'Gestión Dos', requestValue: 'REQ-2', project: 'Proyecto A' };
    const duplicated = makeDraft({ funcional: 'F', ricef: 'R', duplicatedFromGestionId: 'G-1', proyecto: '' });
    expect(applyGestionChange(duplicated, option, 'G-2')).toMatchObject({
      gestionId: 'G-2',
      solicitud: 'REQ-2',
      proyecto: 'Proyecto A',
      funcional: '',
      ricef: '',
      duplicatedFromGestionId: undefined,
    });
    // Misma gestión de origen: conserva funcional y RICEF.
    expect(applyGestionChange(duplicated, { ...option, id: 'G-1' }, 'G-1')).toMatchObject({
      funcional: 'F',
      ricef: 'R',
      duplicatedFromGestionId: 'G-1',
    });
    // Sin opción conocida usa el id como solicitud.
    expect(applyGestionChange(makeDraft(), undefined, 'G-9').solicitud).toBe('G-9');
  });

  it('preferredGestion prioriza la recordada, luego la actual y por último la primera', () => {
    const options = [
      { id: 'G-1', name: 'Uno' },
      { id: 'G-2', name: 'Dos' },
      { id: 'G-3', name: 'Tres' },
    ];
    expect(preferredGestion(options, 'G-3', 'G-2')?.id).toBe('G-3');
    expect(preferredGestion(options, 'G-9', 'G-2')?.id).toBe('G-2');
    expect(preferredGestion(options, '', '')?.id).toBe('G-1');
    expect(preferredGestion([], 'G-1', 'G-1')).toBeUndefined();
  });

  describe('validaciones de horas (dominio sin modificar)', () => {
    it('un registro completo no tiene errores', () => {
      expect(recordErrors(domain, makeDraft())).toEqual([]);
    });

    it('lista campos faltantes e inválidos con los mensajes del dominio', () => {
      expect(recordErrors(domain, makeDraft({ cliente: '', desc: '', horas: '0' }))).toEqual([
        'Cliente',
        'Descripción',
        'Horas debe ser mayor a 0',
      ]);
      expect(recordErrors(domain, makeDraft({ horaIni: '10:00', horaFin: '09:00', horas: '1' }))).toContain(
        'Hora fin debe ser mayor a hora inicio',
      );
      expect(recordErrors(domain, makeDraft({ horaIni: '06:00', horaFin: '23:00', horas: '17' }))).toContain(
        'Duracion maxima 16h',
      );
    });

    it('Fábrica fuera de jornada (19:30-23:59) no tiene errores ni computa contra el tope', () => {
      const factory = makeDraft({ tipoHora: 'Fábrica', horaIni: '19:30', horaFin: '23:59', horas: '4.5' });
      expect(recordErrors(domain, factory)).toEqual([]);
      expect(recordSaveErrors(domain, makeDraft({ tipoHora: 'Fábrica', horaIni: '06:00', horaFin: '20:00', horas: '14' }))).toEqual([]);
      expect(domain.getDailyLaborHoursExceeded([factory, makeDraft({ horaIni: '08:00', horaFin: '16:30', horas: '8.5' })])).toEqual(
        [],
      );
    });

    it('un registro computable no puede superar el máximo diario al guardar (10 h de prueba)', () => {
      expect(recordSaveErrors(domain, makeDraft({ horaIni: '06:00', horaFin: '17:00', horas: '11' }))).toEqual([
        'Un registro computable no puede superar 10 horas',
      ]);
    });

    it('el fin de semana la jornada esperada es 0 h y el tope diario sigue siendo el máximo', () => {
      const saturday = makeDraft({ fecha: '2026-09-12', horaIni: '08:00', horaFin: '10:00', horas: '2' });
      expect(domain.groupByDate([saturday])[0].alerta.label).toBe('Excede 0h');
      expect(recordErrors(domain, saturday)).toEqual([]);
      expect(domain.getDailyLaborHoursExceeded([saturday])).toEqual([]);
    });
  });
});
