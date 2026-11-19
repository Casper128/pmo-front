import { TEST_TIMEZONES, TIMEZONE_OFFSETS, useTimezone } from '@/test/timezones';
import {
  formatDateDisplay,
  formatDateYmd,
  formatFechaEsp,
  normalizeSearch,
  normalizeTime,
  parseDateValue,
  toDateValue,
} from './format';

describe.each(TEST_TIMEZONES)('utilidades de fecha en TZ=%s', (timezone) => {
  useTimezone(timezone);

  it('la zona horaria está aplicada', () => {
    expect(new Date(2026, 10, 18).getTimezoneOffset()).toBe(TIMEZONE_OFFSETS[timezone]);
  });

  describe('formatFechaEsp (port de fecha-esp.pipe)', () => {
    it.each([
      ['2026-11-18', 'Mié 18 Nov 2026'],
      ['2026-01-01', 'Jue 1 Ene 2026'],
      ['2026-12-31', 'Jue 31 Dic 2026'],
      ['2024-02-29', 'Jue 29 Feb 2024'],
      ['2026-03-08', 'Dom 8 Mar 2026'],
      ['2026-05-16', 'Sáb 16 May 2026'],
    ])('%s → %s', (fecha, esperado) => {
      expect(formatFechaEsp(fecha)).toBe(esperado);
    });
  });

  describe('parseDateValue / toDateValue', () => {
    it('parsea YYYY-MM-DD a medianoche local sin cambiar el día', () => {
      const date = parseDateValue('2026-01-01');
      expect(date).toBeInstanceOf(Date);
      expect([date?.getFullYear(), date?.getMonth(), date?.getDate(), date?.getHours()]).toEqual([2026, 0, 1, 0]);
      expect(toDateValue(date as Date)).toBe('2026-01-01');
    });

    it.each([[''], [null], [undefined], ['2026-02-30'], ['2026-13-01'], ['18/11/2026'], ['2026-1-5']])(
      'rechaza %s',
      (value) => {
        expect(parseDateValue(value)).toBeUndefined();
      },
    );

    it('toDateValue usa el día local, también cerca de la medianoche', () => {
      expect(toDateValue(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18');
      expect(toDateValue(new Date(2026, 10, 18, 0, 0))).toBe('2026-11-18');
    });
  });

  describe('formatDateDisplay (texto de ui-date-input)', () => {
    it('muestra el mismo día que el valor', () => {
      expect(formatDateDisplay('2026-11-18')).toBe('18 de nov de 2026');
      expect(formatDateDisplay('2026-01-01')).toBe('01 de ene de 2026');
      expect(formatDateDisplay('')).toBe('');
    });
  });

  describe("formatDateYmd (port de date: 'yyyy-MM-dd')", () => {
    it('conserva las fechas YYYY-MM-DD y rellena con ceros', () => {
      expect(formatDateYmd('2026-11-18')).toBe('2026-11-18');
      expect(formatDateYmd('2026-1-5')).toBe('2026-01-05');
    });

    it('un ISO parcial se construye en hora local como DatePipe (YYYY y YYYY-MM)', () => {
      expect(formatDateYmd('2026-11')).toBe('2026-11-01');
      expect(formatDateYmd('2026-1')).toBe('2026-01-01');
      expect(formatDateYmd('2026')).toBe('2026-01-01');
    });

    it('vacío o inválido → cadena vacía', () => {
      expect(formatDateYmd('')).toBe('');
      expect(formatDateYmd(null)).toBe('');
      expect(formatDateYmd(undefined)).toBe('');
      expect(formatDateYmd('no es fecha')).toBe('');
    });

    it('una fecha-hora ISO se muestra con el día local (como DatePipe sin zona)', () => {
      const expected = { UTC: '2026-11-18', 'America/Bogota': '2026-11-17', 'Asia/Tokyo': '2026-11-18' };
      expect(formatDateYmd('2026-11-18T03:00:00Z')).toBe(expected[timezone]);
    });
  });
});

describe('normalizeTime (port de UiTimeInputComponent.normalize)', () => {
  it.each([
    ['08:30', '08:30'],
    ['8:05', '08:05'],
    ['08:30:00', '08:30'],
    [' 23:59 ', '23:59'],
    ['00:00', '00:00'],
    ['24:00', ''],
    ['7:60', ''],
    ['abc', ''],
    ['', ''],
    [null, ''],
  ])('%s → "%s"', (value, expected) => {
    expect(normalizeTime(value)).toBe(expected);
  });
});

describe('normalizeSearch (búsqueda de ui-select)', () => {
  it('ignora tildes, mayúsculas y espacios de los extremos', () => {
    expect(normalizeSearch('  Medellín ÁRea ')).toBe('medellin area');
  });

  it('descompone y elimina marcas diacríticas combinadas (ñ, ü)', () => {
    expect(normalizeSearch('Peñón Güéjar')).toBe('penon guejar');
  });
});
