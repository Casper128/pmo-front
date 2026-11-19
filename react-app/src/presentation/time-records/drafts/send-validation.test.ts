import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { completeTemplate, makeDraft } from '@/test/fakes/drafts-fixtures';
import { FakeAppParameters, testParameterFields } from '@/test/fakes/fake-app-parameters';
import { buildDayLedger } from '../reports/report-view';
import { buildManagementTemplateMap } from './template-rules';
import { validateBeforeSend, type SendValidationInput } from './send-validation';

const domain = new TimeRecordDomainService(new FakeAppParameters({ fields: testParameterFields() }));
const templates = buildManagementTemplateMap([completeTemplate('G-1', 'Gestión Uno')]);

const input = (overrides: Partial<SendValidationInput> = {}): SendValidationInput => ({
  records: [makeDraft()],
  domain,
  templates,
  knownManagement: () => null,
  ledger: new Map(),
  confirmExcess: false,
  ...overrides,
});
const countable = (tipoHora: string) => domain.isCountableHour(tipoHora);

describe('validateBeforeSend', () => {
  it('sin registros bloquea con el mensaje de Angular', () => {
    expect(validateBeforeSend(input({ records: [] }))).toEqual({
      status: 'blocked',
      title: 'Envío bloqueado',
      text: 'No hay registros listos para enviar.',
    });
  });

  it('una gestión sin plantilla o con plantilla incompleta pide abrir su diálogo', () => {
    const none = validateBeforeSend(input({ templates: buildManagementTemplateMap([]) }));
    expect(none).toMatchObject({ status: 'template', template: null, option: { id: 'G-1' } });

    const incomplete = { ...completeTemplate('G-1', 'Gestión Uno'), completed: false };
    const result = validateBeforeSend(input({ templates: buildManagementTemplateMap([incomplete]) }));
    expect(result).toMatchObject({
      status: 'template',
      template: incomplete,
      text: 'Llena la configuración avanzada de la gestión antes de enviar.',
    });
  });

  it('datos incompletos, registro y día excedidos bloquean con los títulos de Angular', () => {
    expect(validateBeforeSend(input({ records: [makeDraft({ desc: '' })] }))).toMatchObject({
      title: 'Envío bloqueado por datos incompletos',
      text: 'Corrige 1 registros con datos invalidos antes de enviar. Ejemplos: #1 (Descripción)',
    });
    expect(validateBeforeSend(input({ records: [makeDraft({ horaIni: '06:00', horaFin: '17:00', horas: '11' })] }))).toMatchObject({
      title: 'Envío bloqueado por duración inválida',
    });
    expect(
      validateBeforeSend(input({ records: [makeDraft({ horaIni: '06:00', horaFin: '14:00', horas: '8' }), makeDraft({ horaIni: '14:00', horaFin: '16:00', horas: '2' })] })),
    ).toMatchObject({ title: 'Envío bloqueado por exceso diario' });
  });

  it('un fin de semana con más del tope diario se bloquea y dentro del tope pasa', () => {
    const sunday = (horas: string, horaFin: string) => makeDraft({ fecha: '2026-09-13', horaIni: '07:00', horaFin, horas });
    expect(validateBeforeSend(input({ records: [sunday('3', '10:00')] })).status).toBe('ok');
    expect(
      validateBeforeSend(input({ records: [sunday('6', '13:00'), makeDraft({ fecha: '2026-09-13', horaIni: '13:00', horaFin: '18:00', horas: '5' })] })),
    ).toMatchObject({ title: 'Envío bloqueado por exceso diario' });
  });

  it('un horario que se cruza con uno ya enviado bloquea con mensaje claro', () => {
    const records = [makeDraft({ horaIni: '07:30', horaFin: '09:00' })];
    const ledger = buildDayLedger(
      [{ id: 'RH-1', dayKey: '2026-09-09', interval: { startMin: 480, endMin: 540 }, computableHours: 1 }],
      records,
      countable,
    );
    expect(validateBeforeSend(input({ records, ledger }))).toEqual({
      status: 'blocked',
      title: 'Envío bloqueado por horario cruzado',
      text: expect.stringContaining('#1 mié, 09 de sept 07:30-09:00 con 08:00-09:00') as unknown,
    });
  });

  it('tocarse en un extremo con lo enviado no es cruce', () => {
    const records = [makeDraft({ horaIni: '07:30', horaFin: '09:00' })];
    const ledger = buildDayLedger(
      [{ id: 'RH-1', dayKey: '2026-09-09', interval: { startMin: 540, endMin: 600 }, computableHours: 1 }],
      records,
      countable,
    );
    expect(validateBeforeSend(input({ records, ledger })).status).toBe('ok');
  });

  it('el exceso de jornada con lo ya enviado pide confirmar y con confirmación pasa', () => {
    const records = [makeDraft({ horaIni: '07:00', horaFin: '14:00', horas: '7' })];
    const ledger = buildDayLedger(
      [{ id: 'RH-1', dayKey: '2026-09-09', interval: { startMin: 900, endMin: 1020 }, computableHours: 2 }],
      records,
      countable,
    );
    const check = validateBeforeSend(input({ records, ledger }));
    expect(check).toMatchObject({ status: 'confirm', title: 'Exceso de jornada con lo ya enviado' });
    expect(check.status === 'confirm' && check.text).toContain('9.0h/8.5h (2.0h ya enviadas)');
    expect(validateBeforeSend(input({ records, ledger, confirmExcess: true })).status).toBe('ok');
  });

  it('el exceso con lo enviado ignora Fábrica y los días sin borradores computables', () => {
    const records = [makeDraft({ tipoHora: 'Fábrica', horaIni: '19:30', horaFin: '23:59', horas: '4.5' })];
    const ledger = buildDayLedger(
      [{ id: 'RH-1', dayKey: '2026-09-09', interval: { startMin: 480, endMin: 1020 }, computableHours: 9 }],
      records,
      countable,
    );
    expect(validateBeforeSend(input({ records, ledger })).status).toBe('ok');
  });

  it('sin libro mayor (consulta fallida) solo aplica las validaciones locales', () => {
    expect(validateBeforeSend(input({ ledger: null })).status).toBe('ok');
  });
});
