import type {
  SendRecordLog,
  SendResult,
} from '@application/time-records/use-cases/send-all-records.use-case';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';

/** Caso de uso falso: cada `execute` queda pendiente hasta que la prueba lo resuelve o lo rechaza. */
export class SendAllStub {
  runs: {
    records: TimeRecord[];
    onProgress?: (log: SendRecordLog) => void;
    resolve: (result: SendResult) => void;
    reject: (error: unknown) => void;
  }[] = [];

  execute(records: TimeRecord[], onProgress?: (log: SendRecordLog) => void) {
    return new Promise<SendResult>((resolve, reject) => {
      this.runs.push({ records, onProgress, resolve, reject });
    });
  }
}

export const log = (index: number, ok = true): SendRecordLog => ({ index, ok, identificador: `ID-${index}`, errorMessage: ok ? undefined : 'Falló' });

export function result(okIndexes: number[], errorIndexes: number[] = []): SendResult {
  return {
    enviados: okIndexes.length,
    errores: errorIndexes.length,
    enviadosIndices: okIndexes,
    erroresIndices: errorIndexes,
    logs: [...okIndexes.map((i) => log(i)), ...errorIndexes.map((i) => log(i, false))],
  };
}
