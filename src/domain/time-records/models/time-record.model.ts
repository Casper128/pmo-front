export interface TimeRecord {
  fecha: string;
  horaIni: string;
  horaFin: string;
  horas: string;
  desc: string;
  observacion: string;
  cliente: string;
  proyecto: string;
  solicitud: string;
  gestionId: string;
  tipoHora: string;
  funcional?: string;
  ricef?: string;
}

export const TIME_RECORD_DEFAULTS: Omit<
  TimeRecord,
  'fecha' | 'horaIni' | 'horaFin' | 'horas' | 'desc' | 'observacion'
> = {
  cliente: '',
  proyecto: '',
  solicitud: '',
  gestionId: '',
  tipoHora: 'Laboral',
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
  { key: 'cliente', label: 'Cliente' },
  { key: 'solicitud', label: 'Gestión Demanda' },
  { key: 'desc', label: 'Descripción' },
];
