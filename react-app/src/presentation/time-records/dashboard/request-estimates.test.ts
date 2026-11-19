import { describe, expect, it } from 'vitest';
import type { DashboardRequestSummary } from '@domain/time-records/models/time-dashboard.model';
import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { withEstimatedHours } from './request-estimates';

const request = (name: string, hours: number): DashboardRequestSummary => ({
  key: name,
  request: name,
  client: 'Cliente',
  hours,
  count: 1,
  latestAt: '2026-09-09T08:00:00',
  firstAt: '2026-09-09T08:00:00',
  activeDays: 1,
  billing: [],
  estimatedHours: null,
  consumptionPct: null,
});

const template = (gestionId: string, gestionName: string, horasEstimadas?: string): ManagementAdvancedTemplate => ({
  gestionId,
  gestionName,
  values: horasEstimadas === undefined ? {} : ({ horasEstimadas } as ManagementAdvancedTemplate['values']),
});

describe('withEstimatedHours', () => {
  it('une por id o nombre exacto y calcula el consumo', () => {
    const [byId, byName] = withEstimatedHours(
      [request('DO-10', 5), request('Soporte  Mensual', 3)],
      [template('DO-10', 'Gestión X', '10'), template('G2', 'soporte mensual', '12.5')],
    );
    expect(byId).toMatchObject({ estimatedHours: 10, consumptionPct: 50 });
    expect(byName).toMatchObject({ estimatedHours: 12.5, consumptionPct: 24 });
  });

  it('no usa coincidencias parciales', () => {
    const [item] = withEstimatedHours([request('DO-100', 5)], [template('DO-10', 'DO', '10')]);
    expect(item).toMatchObject({ estimatedHours: null, consumptionPct: null });
  });

  it('sin horas válidas o en cero no calcula consumo', () => {
    const items = withEstimatedHours(
      [request('A', 1), request('B', 1), request('C', 1)],
      [template('A', 'A'), template('B', 'B', '0'), template('C', 'C', '-3')],
    );
    expect(items.map((item) => item.consumptionPct)).toEqual([null, null, null]);
    expect(items[1].estimatedHours).toBe(0);
  });
});
