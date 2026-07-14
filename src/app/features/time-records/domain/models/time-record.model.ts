export interface TimeRecord {
  fecha: string;
  horaIni: string;
  horaFin: string;
  horas: string;
  desc: string;
  observacion: string;
  cliente: string;
  ricef: string;
  proyecto: string;
  solicitud: string;
  tipoActividad: string;
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
  fechaEstimada: string;
  fechaReal: string;
  categoria: string;
}

export const TIME_RECORD_DEFAULTS: Omit<TimeRecord, 'fecha' | 'horaIni' | 'horaFin' | 'horas' | 'desc' | 'observacion'> = {
  cliente: '',
  ricef: '',
  proyecto: '',
  solicitud: '',
  tipoActividad: 'ActividadDesarrollo',
  causa: 'Nueva Funcionalidad',
  complejidad: 'Media',
  impacto: 'Media',
  equipo: 'Comercial',
  modoActuacion: 'Basado-Datos-Integraciones',
  lenguaje: 'ABAP',
  tipoHora: 'Laboral',
  funcional: '',
  prefijo: 'CH',
  objetoRicef: '',
  unity: '',
  fechaEstimada: '',
  fechaReal: '',
  categoria: 'Operacion',
};

export interface DayGroup {
  fecha: string;
  records: { record: TimeRecord; index: number }[];
  totalHoras: number;
  alerta: HorasAlert;
}

export interface HorasAlert {
  color: string;
  bg: string;
  border: string;
  icon: string;
  label: string;
}

export interface DailyHoursLimitViolation {
  fecha: string;
  totalHoras: number;
  limiteHoras: number;
  tipoHora: string;
}

export interface RecordHoursLimitViolation {
  index: number;
  fecha: string;
  horas: number;
  limiteHoras: number;
  tipoHora: string;
}

export const REQUIRED_FIELDS: { key: keyof TimeRecord; label: string }[] = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'horaIni', label: 'Hora inicio' },
  { key: 'horaFin', label: 'Hora fin' },
  { key: 'tipoActividad', label: 'Tipo actividad' },
  { key: 'funcional', label: 'Funcional' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'solicitud', label: 'Gestión Demanda' },
  { key: 'desc', label: 'Descripción' },
];
