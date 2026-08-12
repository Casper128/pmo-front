export interface TimeRecordApiBody {
  cliente: string;
  ricef: string;
  proyecto: string;
  solicitud: string;
  tipoActividad: string;
  HoraInicio: string;
  HoraFin: string;
  fechaInicio: string;
  causa: string;
  complejidad: string;
  impacto: string;
  equipo: string;
  modoActuacion: string;
  lenguaje: string;
  tipoHora: string;
  funcional: string;
  prefijo: string;
  objetoRicef: string;
  unity: string;
  descripcionActividad: string;
  observacion: string;
  categoria: string;
  tiempoRealHoras: string;
  fechaEstimadaPruebas: string | null;
  fechaEstimadaRealPruebas: string | null;
}

export interface TimeRecordRegistrationResponse {
  status?: number;
  mensaje?: string;
  message?: string;
  identificador?: string;
  id?: string;
  data?: unknown;
  registro?: unknown;
  tiempo?: unknown;
  [key: string]: unknown;
}
