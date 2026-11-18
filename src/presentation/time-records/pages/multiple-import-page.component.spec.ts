import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscriber, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeRecord } from '@domain/time-records/models/time-record.model';
import {
  TimeRecordDomainService,
  TimeRecordParameters,
} from '@domain/time-records/services/time-record-domain.service';
import {
  SendAllRecordsUseCase,
  SendRecordLog,
  SendResult,
} from '@application/time-records/use-cases/send-all-records.use-case';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import { AuthGateway } from '@application/auth/auth.gateway';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { ManagementTemplateGateway } from '@application/time-records/ports/management-template.gateway';
import { MultipleImportPageComponent } from './multiple-import-page.component';

const STORAGE_KEY = 'pmo_pending_time_records';

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

function draft(horaIni: string, horaFin: string, horas: string): TimeRecord {
  return {
    fecha: '2026-09-09',
    horaIni,
    horaFin,
    horas,
    desc: `Actividad ${horaIni}`,
    observacion: '',
    cliente: 'Cliente A',
    proyecto: 'Proyecto A',
    solicitud: 'Gestión A',
    gestionId: 'G-1',
    tipoHora: 'Laboral',
  };
}

/** Caso de uso falso: cada `execute` queda pendiente hasta que la prueba emite sus progresos. */
class SendAllStub {
  runs: {
    records: TimeRecord[];
    onProgress?: (log: SendRecordLog) => void;
    subscriber?: Subscriber<SendResult>;
  }[] = [];

  execute(records: TimeRecord[], onProgress?: (log: SendRecordLog) => void) {
    const run: (typeof this.runs)[number] = { records, onProgress };
    this.runs.push(run);
    return new Observable<SendResult>((subscriber) => {
      run.subscriber = subscriber;
    });
  }
}

function log(index: number, ok = true): SendRecordLog {
  return { index, ok, identificador: `ID-${index}` };
}

function result(okIndexes: number[], errorIndexes: number[] = []): SendResult {
  return {
    enviados: okIndexes.length,
    errores: errorIndexes.length,
    enviadosIndices: okIndexes,
    erroresIndices: errorIndexes,
    logs: [...okIndexes.map((i) => log(i)), ...errorIndexes.map((i) => log(i, false))],
  };
}

function storedRecords(): TimeRecord[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as TimeRecord[];
}

describe('MultipleImportPageComponent · envío de una sola ejecución', () => {
  let sendAll: SendAllStub;
  let sendLogs: { createMany: ReturnType<typeof vi.fn> };
  let page: MultipleImportPageComponent;

  beforeEach(() => {
    localStorage.clear();
    sendAll = new SendAllStub();
    sendLogs = { createMany: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: TimeRecordDomainService, useValue: new TimeRecordDomainService(parameters) },
        { provide: SendAllRecordsUseCase, useValue: sendAll },
        { provide: LoadSelectOptionsUseCase, useValue: {} },
        { provide: TimeManagementGateway, useValue: {} },
        { provide: SendLogGateway, useValue: sendLogs },
        { provide: AuthGateway, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: AppParametersFacade, useValue: { defaultFor: () => '', optionsFor: () => [] } },
        { provide: ManagementTemplateGateway, useValue: {} },
      ],
    });
    page = TestBed.runInInjectionContext(() => new MultipleImportPageComponent());
    // La validación de plantillas avanzadas no es objeto de estas pruebas.
    vi.spyOn(
      page as unknown as { firstBlockedManagementTemplate: () => null },
      'firstBlockedManagementTemplate',
    ).mockReturnValue(null);
    page.onDraftRecordsChange([
      draft('07:30', '09:00', '1.5'),
      draft('09:00', '10:00', '1.0'),
      draft('10:00', '11:00', '1.0'),
    ]);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('ignora cambios de borradores y un segundo envío mientras se envía', () => {
    page.onSendAll();
    const before = page.records();

    page.onPreviewRecordChange({ index: 0, record: { ...before[0], gestionId: 'G-2' } });
    page.onDraftRecordsChange([draft('12:00', '13:00', '1.0')]);
    page.onDuplicateDraftRecord(0);
    page.onSendAll();

    expect(sendAll.runs).toHaveLength(1);
    expect(page.sendPhase()).toBe('sending');
    expect(page.sending()).toBe(true);
    expect(page.records()).toBe(before);
  });

  it('el contador y el porcentaje nunca superan el total', () => {
    page.onSendAll();
    const run = sendAll.runs[0];

    [0, 1, 2, 0, 1].forEach((index) => run.onProgress?.(log(index)));

    expect(page.sendTotal()).toBe(3);
    expect(page.sendProcessed()).toBe(3);
    expect(page.sendProgressPercent()).toBe(100);
  });

  it('ignora los progresos de una ejecución anterior', () => {
    page.onSendAll();
    const first = sendAll.runs[0];
    first.subscriber?.error(new Error('fallo de red'));
    expect(page.sendPhase()).toBe('failed');
    page.continueAfterSend();

    page.onSendAll();
    first.onProgress?.(log(0));
    first.onProgress?.(log(1));

    expect(sendAll.runs).toHaveLength(2);
    expect(page.sendProcessed()).toBe(0);
    expect(storedRecords()).toHaveLength(3);
  });

  it('retira de localStorage cada registro en cuanto se confirma', () => {
    page.onSendAll();
    const run = sendAll.runs[0];

    run.onProgress?.(log(0));
    expect(storedRecords().map((r) => r.horaIni)).toEqual(['09:00', '10:00']);

    run.onProgress?.(log(1, false));
    expect(storedRecords().map((r) => r.horaIni)).toEqual(['09:00', '10:00']);

    run.onProgress?.(log(2));
    expect(storedRecords().map((r) => r.horaIni)).toEqual(['09:00']);
  });

  it('en log-error los registros confirmados no quedan en borradores', () => {
    sendLogs.createMany.mockReturnValue(throwError(() => new Error('sin historial')));
    page.onSendAll();
    const run = sendAll.runs[0];
    run.onProgress?.(log(0));
    run.onProgress?.(log(1, false));
    run.onProgress?.(log(2));
    run.subscriber?.next(result([0, 2], [1]));
    run.subscriber?.complete();

    expect(page.sendPhase()).toBe('log-error');
    expect(page.records().map((r) => r.horaIni)).toEqual(['09:00']);

    page.continueAfterSend();
    expect(page.sendPhase()).toBe('idle');
    expect(page.records().map((r) => r.horaIni)).toEqual(['09:00']);
    expect(storedRecords().map((r) => r.horaIni)).toEqual(['09:00']);
  });

  it('al completar poda por referencia los registros confirmados', () => {
    page.onSendAll();
    const run = sendAll.runs[0];
    run.onProgress?.(log(0));
    run.onProgress?.(log(1));
    run.onProgress?.(log(2, false));
    run.subscriber?.next(result([0, 1], [2]));
    run.subscriber?.complete();

    expect(page.sendPhase()).toBe('completed');
    expect(page.records().map((r) => r.horaIni)).toEqual(['10:00']);
    expect(storedRecords().map((r) => r.horaIni)).toEqual(['10:00']);
  });
});
