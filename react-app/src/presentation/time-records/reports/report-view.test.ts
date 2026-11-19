import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { makeDraft } from '@/test/fakes/drafts-fixtures';
import { NO_DAY_KEY, buildDayLedger, intervalsOverlap, reportDayKey, toReportView } from './report-view';

const isCountable = (tipoHora: string) => !tipoHora.toLowerCase().includes('fábrica');

const report = (overrides: Partial<ManagementReport> = {}): ManagementReport => ({
  identificador: 'RH-1',
  HoraInicio: '2026-09-09T07:30:00.000Z',
  HoraFin: '2026-09-09T09:00:00.000Z',
  fechaInicio: 'Wed Sep 09 2026 12:00:00 GMT-0500 (Colombia Standard Time)',
  tiempoRealHoras: '1.5',
  tipoHora: 'Laboral',
  ...overrides,
});

describe('reportDayKey', () => {
  it('toma el día de la hora de pared de HoraInicio sin convertir de zona', () => {
    expect(reportDayKey(report({ HoraInicio: '2026-09-09T23:30:00.000Z' }))).toBe('2026-09-09');
  });

  it('sin HoraInicio usa fechaInicio, ISO o con la etiqueta de Colombia', () => {
    expect(reportDayKey(report({ HoraInicio: undefined }))).toBe('2026-09-09');
    expect(reportDayKey(report({ HoraInicio: undefined, fechaInicio: '2026-09-10T00:00:00.000Z' }))).toBe('2026-09-10');
  });

  it('devuelve sin-fecha si ningún campo sirve o la fecha no existe', () => {
    expect(reportDayKey(report({ HoraInicio: undefined, fechaInicio: undefined }))).toBe(NO_DAY_KEY);
    expect(reportDayKey(report({ HoraInicio: '2026-02-31T07:00:00.000Z', fechaInicio: 'basura' }))).toBe(NO_DAY_KEY);
  });
});

describe('toReportView', () => {
  it('calcula día, horario y horas computables', () => {
    expect(toReportView(report(), isCountable)).toEqual({
      id: 'RH-1',
      dayKey: '2026-09-09',
      interval: { startMin: 450, endMin: 540 },
      computableHours: 1.5,
    });
  });

  it('Fábrica no es computable y un horario inválido queda sin intervalo', () => {
    const view = toReportView(report({ tipoHora: 'Fábrica', HoraFin: '2026-09-09T07:00:00.000Z', tiempoRealHoras: 'x' }), isCountable);
    expect(view.computableHours).toBe(0);
    expect(view.interval).toBeNull();
  });
});

describe('buildDayLedger', () => {
  it('suma por día las horas enviadas y las de borradores, sin contar Fábrica ni días sin fecha', () => {
    const sent = [
      toReportView(report(), isCountable),
      toReportView(report({ identificador: 'RH-2', tipoHora: 'Fábrica', tiempoRealHoras: '4' }), isCountable),
      toReportView(report({ identificador: 'RH-3', HoraInicio: undefined, fechaInicio: undefined }), isCountable),
    ];
    const ledger = buildDayLedger(
      sent,
      [makeDraft({ horas: '2' }), makeDraft({ horas: '3', tipoHora: 'Fábrica' }), makeDraft({ fecha: '2026-09-10', horas: '1' })],
      isCountable,
    );

    expect(ledger.get('2026-09-09')).toEqual({
      sentHours: 1.5,
      draftHours: 2,
      sentIntervals: [
        { startMin: 450, endMin: 540 },
        { startMin: 450, endMin: 540 },
      ],
    });
    expect(ledger.get('2026-09-10')).toMatchObject({ sentHours: 0, draftHours: 1 });
    expect(ledger.has(NO_DAY_KEY)).toBe(false);
  });
});

describe('intervalsOverlap', () => {
  it('tocarse en un extremo no es cruce', () => {
    const a = { startMin: 60, endMin: 120 };
    expect(intervalsOverlap(a, { startMin: 120, endMin: 180 })).toBe(false);
    expect(intervalsOverlap(a, { startMin: 90, endMin: 180 })).toBe(true);
  });
});
