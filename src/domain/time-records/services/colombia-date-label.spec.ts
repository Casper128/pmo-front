import { describe, expect, it } from 'vitest';
import { colombiaDateLabel } from './colombia-date-label';

/** Día calendario de un instante visto desde la zona indicada, sin depender del TZ del proceso. */
function dayIn(timeZone: string, label: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(label));
}

describe('colombiaDateLabel', () => {
  it.each([
    ['2026-09-09', 'Wed Sep 09 2026 12:00:00 GMT-0500 (Colombia Standard Time)'],
    ['2026-09-30', 'Wed Sep 30 2026 12:00:00 GMT-0500 (Colombia Standard Time)'],
    ['2026-01-01', 'Thu Jan 01 2026 12:00:00 GMT-0500 (Colombia Standard Time)'],
    ['2026-12-31', 'Thu Dec 31 2026 12:00:00 GMT-0500 (Colombia Standard Time)'],
    ['2026-09-12', 'Sat Sep 12 2026 12:00:00 GMT-0500 (Colombia Standard Time)'],
    ['2026-09-13', 'Sun Sep 13 2026 12:00:00 GMT-0500 (Colombia Standard Time)'],
  ])('ancla %s al mediodía de Colombia', (fecha, expected) => {
    expect(colombiaDateLabel(fecha)).toBe(expected);
  });

  it.each(['2026-09-09', '2026-09-30', '2026-12-31', '2026-02-28'])(
    'conserva el día %s en UTC y en America/Bogota',
    (fecha) => {
      const label = colombiaDateLabel(fecha);
      expect(new Date(label).toISOString().slice(0, 10)).toBe(fecha);
      expect(dayIn('UTC', label)).toBe(fecha);
      expect(dayIn('America/Bogota', label)).toBe(fecha);
    },
  );
});
