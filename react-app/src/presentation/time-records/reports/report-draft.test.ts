import { TimeRecordDomainService, type TimeRecordParameters } from '@domain/time-records/services/time-record-domain.service';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { FakeAppParameters } from '@/test/fakes/fake-app-parameters';
import { buildReportEditBody, dayLoad, effectiveHours, parseHoursInput, reportEditErrors, reportToDraft, type ReportEditValues } from './report-draft';
import { toReportRow } from './report-list';
import { buildDayLedger, toReportView } from './report-view';

const domain = new TimeRecordDomainService(new FakeAppParameters() as unknown as TimeRecordParameters);
const isCountable = (tipoHora: string) => domain.isCountableHour(tipoHora);

const base: ManagementReport = {
  identificador: 'RH-1',
  HoraInicio: '2026-09-09T08:00:00.000Z',
  HoraFin: '2026-09-09T10:00:00.000Z',
  tiempoRealHoras: '2',
  tipoHora: 'Laboral',
  descripcionActividad: 'Actividad',
  solicitud: 'G-1',
  proyecto: 'Proyecto A',
  solicitud_tiemposConsultores: { nombreGestion: 'Gestión Uno', solicitud_cliente: { nombre: 'Cliente Alfa' } },
};

const values = (overrides: Partial<ReportEditValues> = {}): ReportEditValues => ({
  fecha: '2026-09-09',
  horaIni: '08:00',
  horaFin: '10:00',
  tipoHora: 'Laboral',
  horas: '2',
  descripcion: 'Actividad',
  ...overrides,
});

describe('parseHoursInput', () => {
  it('acepta coma o punto con hasta 2 decimales y rechaza el resto en vez de devolver 0', () => {
    expect(parseHoursInput('1,5')).toBe(1.5);
    expect(parseHoursInput(' 2.25 ')).toBe(2.25);
    expect(parseHoursInput('1,555')).toBeNull();
    expect(parseHoursInput('abc')).toBeNull();
    expect(parseHoursInput('')).toBeNull();
  });
});

describe('reportToDraft', () => {
  it('copia los datos del reporte y marca el origen de la gestión', () => {
    const draft = reportToDraft(toReportRow(base, isCountable), domain, 'Laboral', { fecha: '2026-09-18' });
    expect(draft).toMatchObject({
      fecha: '2026-09-18',
      horaIni: '08:00',
      horaFin: '10:00',
      horas: '2.0',
      cliente: 'Cliente Alfa',
      solicitud: 'Gestión Uno',
      gestionId: 'G-1',
      duplicatedFromGestionId: 'G-1',
      proyecto: 'Proyecto A',
    });
  });

  it('sin horario no inventa horas: quedan vacías', () => {
    const draft = reportToDraft(toReportRow({ ...base, HoraInicio: undefined, HoraFin: undefined }, isCountable), domain, 'Laboral', { fecha: '2026-09-18' });
    expect(draft).toMatchObject({ horaIni: '', horaFin: '' });
  });
});

describe('reportEditErrors', () => {
  it('un reporte válido no tiene errores', () => {
    expect(reportEditErrors(domain, values())).toEqual([]);
  });

  it('exige descripción, fin posterior al inicio y respeta la duración máxima del registro', () => {
    expect(reportEditErrors(domain, values({ descripcion: '  ' }))).toContain('Descripción requerida');
    expect(reportEditErrors(domain, values({ horaIni: '10:00', horaFin: '09:00' }))).toContain('Hora fin debe ser mayor a hora inicio');
    expect(reportEditErrors(domain, values({ horaIni: '00:00', horaFin: '23:00' }))).toContain('Duracion maxima 16h');
  });

  it('en Fábrica las horas se teclean y un valor inválido es un error, no 0', () => {
    expect(effectiveHours(domain, values({ tipoHora: 'Fábrica', horas: '1,5' }))).toBe('1.5');
    expect(reportEditErrors(domain, values({ tipoHora: 'Fábrica', horas: '1,555' }))).toEqual([
      'Horas inválidas: usa hasta 2 decimales, por ejemplo 1,5',
    ]);
  });

  it('las horas de un tipo computable salen del horario, no de lo tecleado', () => {
    expect(effectiveHours(domain, values({ horas: '9' }))).toBe('2.0');
  });
});

describe('buildReportEditBody', () => {
  it('usa hora de pared con Z y la etiqueta de fecha de Colombia', () => {
    expect(buildReportEditBody(values({ descripcion: ' Nueva ' }), '2.0')).toEqual({
      HoraInicio: '2026-09-09T08:00:00.000Z',
      HoraFin: '2026-09-09T10:00:00.000Z',
      tiempoRealHoras: '2.0',
      fechaInicio: 'Wed Sep 09 2026 12:00:00 GMT-0500 (Colombia Standard Time)',
      tipoHora: 'Laboral',
      descripcionActividad: 'Nueva',
      observacion: 'Nueva',
    });
  });
});

describe('dayLoad', () => {
  const mine = toReportView(base, isCountable);
  const other = toReportView({ ...base, identificador: 'RH-2', HoraInicio: '2026-09-09T13:00:00.000Z', HoraFin: '2026-09-09T15:00:00.000Z' }, isCountable);
  const ledger = buildDayLedger([mine, other], [], isCountable);

  it('detecta el cruce con otros reportes y suma las horas del día', () => {
    expect(dayLoad(ledger, '2026-09-09', { interval: { startMin: 14 * 60, endMin: 16 * 60 }, computableHours: 2 })).toEqual({ overlaps: true, totalHours: 6 });
    expect(dayLoad(ledger, '2026-09-09', { interval: { startMin: 10 * 60, endMin: 11 * 60 }, computableHours: 1 })).toEqual({ overlaps: false, totalHours: 5 });
  });

  it('al editar descuenta el propio reporte: no se cruza consigo mismo ni cuenta sus horas dos veces', () => {
    expect(dayLoad(ledger, '2026-09-09', { interval: mine.interval, computableHours: 2 }, mine)).toEqual({ overlaps: false, totalHours: 4 });
  });

  it('sin libro mayor no avisa de nada', () => {
    expect(dayLoad(null, '2026-09-09', { interval: mine.interval, computableHours: 2 })).toEqual({ overlaps: false, totalHours: 2 });
  });
});
