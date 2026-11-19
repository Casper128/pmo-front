import { useMutation } from '@tanstack/react-query';
import type { ReportDownloadFilter } from '@domain/time-records/models/management-report.model';
import { useContainer } from '@presentation/providers/container-context';
import { errorMessage } from '@presentation/shared/error-message';
import { parseConsolidatedExcel } from './consolidated-excel';
import type { ConsolidatedRow } from './consolidated-report';

export interface ConsolidatedResult {
  readonly rows: readonly ConsolidatedRow[];
  /** Excel recibido (base64), para descargarlo tal cual; `null` si el servidor no devolvió datos. */
  readonly excel: string | null;
  /** Motivo que informa el servidor cuando no hay datos. */
  readonly message: string;
}

/** Cuerpo de `filtroDownload`: fechas con la misma hora fija que Angular y cliente numérico cuando lo es. */
export function downloadFilter(from: string, to: string, client: string): ReportDownloadFilter {
  const numericClient = Number(client);
  return {
    fechaInicio: `${from}T05:00:00.000Z`,
    fechaFin: `${to}T05:00:00.000Z`,
    cliente: client ? (Number.isNaN(numericClient) ? client : numericClient) : null,
    idConsultor: null,
    proyecto: null,
    solicitud: null,
  };
}

/** Genera el consolidado: pide el Excel al servidor y lo convierte en filas. Cierra la sesión si expiró (401/403). */
export function useConsolidatedReport() {
  const { timeManagement, auth } = useContainer();
  return useMutation<ConsolidatedResult, unknown, ReportDownloadFilter>({
    mutationFn: async (filter) => {
      const response = await timeManagement.download(filter);
      if (!response.excel) {
        return { rows: [], excel: null, message: response.mensaje || 'No hay registros para los filtros seleccionados.' };
      }
      try {
        return { rows: await parseConsolidatedExcel(response.excel), excel: response.excel, message: '' };
      } catch (error) {
        throw new Error(`No se pudo leer el reporte recibido: ${errorMessage(error) || 'formato no válido'}`, { cause: error });
      }
    },
    onError: (error) => {
      if (auth.isSessionExpiredError(error)) auth.clearTokens();
    },
  });
}
