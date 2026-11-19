import { describe, expect, it } from 'vitest';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { latestReport, monthToDateRange } from './profile-summary';

const report = (day: string, hora: string, overrides: Partial<ManagementReport> = {}): ManagementReport => ({
  identificador: `${day}-${hora}`,
  fechaInicio: `${day}T05:00:00.000Z`,
  HoraInicio: `${day}T${hora}:00.000Z`,
  tiempoRealHoras: '1',
  cliente: 'Cliente Alfa',
  solicitud: 'Gestión Uno',
  ...overrides,
});

describe('profile-summary', () => {
  it('rango del mes hasta hoy', () => {
    expect(monthToDateRange('2026-09-18')).toEqual({ from: '2026-09-01', to: '2026-09-18' });
  });

  it('último reporte por fecha y hora; sin reportes es null', () => {
    expect(latestReport([])).toBeNull();
    const last = latestReport([report('2026-09-10', '08:00'), report('2026-09-12', '09:00', { solicitud: 'Gestión Dos' }), report('2026-09-12', '07:00')]);
    expect(last).toEqual({ date: '2026-09-12', request: 'Gestión Dos', client: 'Cliente Alfa' });
  });

  it('ignora reportes sin fecha y usa valores por defecto', () => {
    const last = latestReport([{ identificador: 'x' } as ManagementReport, report('2026-09-01', '08:00', { solicitud: '', cliente: '' })]);
    expect(last).toMatchObject({ date: '2026-09-01', request: 'Sin solicitud', client: 'Sin cliente' });
  });
});
