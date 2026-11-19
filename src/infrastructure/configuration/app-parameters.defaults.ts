import type {
  AdvancedFieldConfiguration,
  ParameterOption,
  WorkSettings,
} from '@domain/configuration/app-parameters.model';

const option = (value: string, sortOrder: number, label = value): ParameterOption => ({
  value,
  label,
  active: true,
  sortOrder,
});
const options = (values: string[]): ParameterOption[] =>
  values.map((value, index) => option(value, index));

export const DEFAULT_ADVANCED_FIELDS: AdvancedFieldConfiguration[] = [
  {
    key: 'tipoActividad',
    label: 'Tipo de actividad',
    defaultValue: 'ActividadDesarrollo',
    options: options([
      'ActividadDesarrollo',
      'Control De Cambio',
      'Debug',
      'Analisis Funcional',
      'Soporte',
      'Reunion',
      'Estimacion',
      'Despliegue',
    ]),
  },
  {
    key: 'causa',
    label: 'Causa',
    defaultValue: 'Nueva Funcionalidad',
    options: options([
      'Garantia',
      'Data Maestra',
      'Falta Configuraion',
      'EscenarioNoProbado',
      'EscenarioNoContemplado',
      'Nueva Funcionalidad',
      'Administrativo',
      'Reunion',
    ]),
  },
  {
    key: 'complejidad',
    label: 'Complejidad',
    defaultValue: 'Media',
    options: options(['Alta', 'Media', 'Baja']),
  },
  {
    key: 'impacto',
    label: 'Impacto',
    defaultValue: 'Media',
    options: options(['Alta', 'Media', 'Baja']),
  },
  {
    key: 'equipo',
    label: 'Equipo',
    defaultValue: 'Comercial',
    options: options([
      'Financiero',
      'Comercial',
      'Logistico',
      'PlaneacionDemanda',
      'Analitica',
      'Portales',
      'Infraestructura',
    ]),
  },
  {
    key: 'modoActuacion',
    label: 'Modo de actuación',
    defaultValue: 'Basado-Datos-Integraciones',
    options: options([
      'Basado-Datos-Integraciones',
      'Basado-Datos-Automatizacion',
      'Basado-Datos-Analitica',
      'OXDE',
      'Transaccional',
    ]),
  },
  {
    key: 'lenguaje',
    label: 'Lenguaje',
    defaultValue: 'ABAP',
    options: options([
      'JavaScript',
      'Java',
      'PHP',
      'PullOvers',
      'ABAP',
      'NODEjs',
      'PO',
      'OData',
      'DataService',
      'Strling',
      'Python',
      'UiPath',
      'Agility',
    ]),
  },
  {
    key: 'tipoHora',
    label: 'Tipo de hora',
    defaultValue: 'Laboral',
    options: options(['Laboral', 'Fabrica']),
  },
  {
    key: 'prefijo',
    label: 'Prefijo',
    defaultValue: 'CH',
    options: options(['CH', 'SR', 'IN', 'Proyecto']),
  },
  {
    key: 'objetoRicef',
    label: 'Objeto RICEF',
    defaultValue: '',
    options: options(['Interfases', 'Reportes', 'Conversiones', 'Enhacement', 'Formularios']),
  },
  {
    key: 'categoria',
    label: 'Categoría',
    defaultValue: 'Operacion',
    options: options(['Everest', 'Operacion', 'Proyecto', 'Coordinacion']),
  },
];

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  mondayThursdayHours: 8.5,
  fridayHours: 8,
  dailyHours: {
    0: 0,
    1: 8.5,
    2: 8.5,
    3: 8.5,
    4: 8.5,
    5: 8,
    6: 0,
  },
  maxDailyLaborHours: 10,
  maxHoursPerRecord: 16,
};

/** Clave de localStorage (la misma que la app Angular). */
export const APP_PARAMETERS_STORAGE_KEY = 'pmo_app_parameters_global_v1';
