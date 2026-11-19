import { createContext, useContext } from 'react';
import type { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { AppSelectOption } from '@presentation/shared/components/app-select';

/** Datos y acciones que comparten las celdas y tarjetas de la vista previa (columnas estables de TanStack). */
export interface PreviewContextValue {
  /** Envío en curso o pendiente de confirmar: selects y acciones deshabilitados. */
  readonly locked: boolean;
  readonly clientes: readonly string[];
  readonly tipoHoraOptions: readonly AppSelectOption[];
  readonly onClienteChange: (index: number, cliente: string) => void;
  readonly onGestionChange: (
    index: number,
    record: TimeRecord,
    option: ManagementDemandOption | undefined,
    gestionId: string,
  ) => void;
  readonly onTipoHoraChange: (index: number, tipoHora: string) => void;
  readonly onEdit: (index: number) => void;
  readonly onDuplicate: (index: number) => void;
  readonly onDelete: (index: number) => void;
}

export const PreviewContext = createContext<PreviewContextValue | null>(null);

export function usePreview(): PreviewContextValue {
  const value = useContext(PreviewContext);
  if (!value) throw new Error('usePreview debe usarse dentro de <RecordsPreviewTable>.');
  return value;
}
