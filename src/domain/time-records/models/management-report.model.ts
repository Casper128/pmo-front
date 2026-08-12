export interface ManagementReport {
  idConsultor?: string | number;
  idUsuario?: string | number;
  consultor?: string;
  nombreConsultor?: string;
  usuario?: string;
  email?: string;
  correo?: string;
  cliente?: string;
  identificador?: string;
  prefijo?: string;
  tipoHora?: string;
  tipoActividad?: string;
  causa?: string;
  descripcionActividad?: string;
  observacion?: string;
  fechaInicio?: string;
  categoria?: string;
  modulo?: string;
  tecnologia?: string;
  proyecto?: string;
  gestionDemanda?: string;
  lenguaje?: string;
  objetoRicef?: string;
  equipo?: string;
  modoActuacion?: string;
  complejidad?: string;
  impacto?: string;
  funcional?: string;
  tiempoRealHoras?: string | number;
  solicitud?: string;
  HoraInicio?: string;
  HoraFin?: string;
  fechaEstimadaPruebas?: string;
  fechaEstimadaRealPruebas?: string;
  solicitud_tiemposConsultores?: {
    nombreGestion?: string;
    tipoSolicitud?: string;
    prioridad?: string;
    solicitud_cliente?: { nombre?: string };
  };
  usuario_tiemposConsultores?: {
    id?: string | number;
    nombre?: string;
    email?: string;
    correo?: string;
    usuario?: string;
  };
  [key: string]: unknown;
}

export interface ReportDownloadFilter {
  fechaInicio: string;
  fechaFin: string;
  cliente: string | number | null;
  idConsultor: string | number | null;
  proyecto: string | number | null;
  solicitud: string | number | null;
}

export interface ReportDownloadResponse {
  excel?: string;
  mensaje?: string;
}
