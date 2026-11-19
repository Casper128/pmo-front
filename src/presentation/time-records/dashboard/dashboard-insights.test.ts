import { describe, expect, it } from 'vitest';
import type { DashboardDailyPoint } from '@domain/time-records/models/time-dashboard.model';
import { buildDelta, complianceSummary, lastDays, seriesColor, topWithOthers } from './dashboard-insights';

const day = (date: string, hours: number): DashboardDailyPoint => ({ date, label: date, shortLabel: date.slice(5), hours, count: hours ? 1 : 0 });
// 2026-09-12 es sábado: sin horas esperadas.
const expectedFor = (date: string) => (date === '2026-09-12' ? 0 : 8);

describe('buildDelta', () => {
  it('sin periodo anterior no hay delta', () => expect(buildDelta(null)).toBeUndefined());
  it('positivo sube, negativo baja, cero neutro', () => {
    expect(buildDelta(12.5)).toMatchObject({ label: '+12,5 %', trend: 'up' });
    expect(buildDelta(-3)).toMatchObject({ label: '-3 %', trend: 'down' });
    expect(buildDelta(0)).toMatchObject({ label: '0 %', trend: 'neutral' });
  });
});

describe('complianceSummary', () => {
  it('cuenta días completos, incompletos y sin reporte; ignora los no laborables', () => {
    const summary = complianceSummary(
      [day('2026-09-10', 8), day('2026-09-11', 4), day('2026-09-12', 0), day('2026-09-13', 0), day('2026-09-14', 9)],
      (date) => (date === '2026-09-12' || date === '2026-09-13' ? 0 : 8),
    );
    expect(summary).toMatchObject({ fullDays: 2, incompleteDays: 1, missingDays: 0, expectedHours: 24, reportedHours: 21 });
    expect(summary.pct).toBeCloseTo(87.5);
  });
  it('sin días laborables el cumplimiento es 0', () => {
    expect(complianceSummary([day('2026-09-12', 3)], expectedFor).pct).toBe(0);
  });
  it('días laborables sin horas son "sin reporte"', () => {
    expect(complianceSummary([day('2026-09-10', 0)], expectedFor)).toMatchObject({ missingDays: 1, pct: 0 });
  });
});

describe('lastDays y topWithOthers', () => {
  it('toma los últimos N días', () => {
    const daily = Array.from({ length: 10 }, (_, i) => day(`2026-09-${String(i + 1).padStart(2, '0')}`, i));
    expect(lastDays(daily, 7).map((p) => p.hours)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });
  it('agrupa el resto en Otros y calcula el %', () => {
    const items = ['a', 'b', 'c', 'd'].map((label, i) => ({ label, hours: 10 - i * 2, count: 1 }));
    const top = topWithOthers(items, 3);
    expect(top.map((i) => i.label)).toEqual(['a', 'b', 'Otros']);
    expect(top[2]).toMatchObject({ hours: 10, count: 2 });
    expect(top.reduce((s, i) => s + i.share, 0)).toBeCloseTo(100);
  });
  it('color cíclico de la serie', () => expect(seriesColor(5)).toBe('var(--chart-1)'));
});
