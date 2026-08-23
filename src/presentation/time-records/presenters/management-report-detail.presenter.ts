import { ManagementReport } from '@domain/time-records/models/management-report.model';

export interface DetailField {
  key: string;
  label: string;
  value: string;
}

export interface DetailSection {
  title: string;
  eyebrow: string;
  fields: DetailField[];
}

export class ManagementReportDetailPresenter {
  private readonly labelByPath: Record<string, string> = {
    idConsultor: 'ID consultor',
    idUsuario: 'ID usuario',
    consultor: 'Consultor',
    nombreConsultor: 'Nombre consultor',
    identificador: 'Identificador',
    tipoHora: 'Tipo de hora',
    tipoActividad: 'Tipo actividad',
    descripcionActividad: 'Descripción actividad',
    fechaInicio: 'Fecha inicio',
    tiempoRealHoras: 'Tiempo real horas',
    gestionDemanda: 'Gestión demanda',
    objetoRicef: 'Objeto RICEF',
    ricef: 'RICEF',
    unity: 'Módulo SAP',
    modulo: 'Módulo',
    modoActuacion: 'Modo actuación',
    fechaEstimadaPruebas: 'Fecha estimada pruebas',
    fechaEstimadaRealPruebas: 'Fecha estimada real pruebas',
    HoraInicio: 'Hora inicio',
    HoraFin: 'Hora fin',
    'solicitud_tiemposConsultores.nombreGestion': 'Gestión',
    'solicitud_tiemposConsultores.tipoSolicitud': 'Tipo solicitud',
    'solicitud_tiemposConsultores.prioridad': 'Prioridad',
    'solicitud_tiemposConsultores.solicitud_cliente.nombre': 'Cliente solicitud',
    'usuario_tiemposConsultores.id': 'Usuario ID',
    'usuario_tiemposConsultores.nombre': 'Usuario nombre',
    'usuario_tiemposConsultores.email': 'Usuario email',
    'usuario_tiemposConsultores.correo': 'Usuario correo',
    'usuario_tiemposConsultores.usuario': 'Usuario',
  };

  private readonly usedPrimaryPaths = new Set([
    'identificador',
    'solicitud_tiemposConsultores.nombreGestion',
    'solicitud',
    'solicitud_tiemposConsultores.tipoSolicitud',
    'solicitud_tiemposConsultores.prioridad',
    'solicitud_tiemposConsultores.solicitud_cliente.nombre',
    'cliente',
    'fechaInicio',
    'HoraInicio',
    'HoraFin',
    'tiempoRealHoras',
    'tipoHora',
    'descripcionActividad',
    'observacion',
    'tipoActividad',
    'categoria',
    'funcional',
    'consultor',
    'nombreConsultor',
    'usuario_tiemposConsultores.nombre',
    'usuario_tiemposConsultores.email',
  ]);

  private readonly usedSecondaryPaths = new Set([
    'causa',
    'complejidad',
    'impacto',
    'equipo',
    'modoActuacion',
    'lenguaje',
    'prefijo',
    'objetoRicef',
    'ricef',
    'modulo',
    'tecnologia',
    'proyecto',
    'fechaEstimadaPruebas',
    'fechaEstimadaRealPruebas',
  ]);

  title(report: ManagementReport): string {
    return report.identificador || this.managementName(report);
  }

  managementName(report: ManagementReport): string {
    return (
      report.solicitud_tiemposConsultores?.nombreGestion ||
      report.solicitud ||
      report.identificador ||
      'Sin gestion'
    );
  }

  clientName(report: ManagementReport): string {
    return (
      report.solicitud_tiemposConsultores?.solicitud_cliente?.nombre ||
      report.cliente ||
      'Sin cliente'
    );
  }

  formatHours(report: ManagementReport): string {
    const value = Number(report.tiempoRealHoras || 0);
    if (!Number.isFinite(value)) return '0';
    return value.toFixed(value % 1 === 0 ? 0 : 1);
  }

  reportDate(report: ManagementReport): string {
    return (
      this.normalizeDateValue(report.fechaInicio || '') ||
      this.normalizeDateValue(report.HoraInicio || '')
    );
  }

  primarySections(report: ManagementReport): DetailSection[] {
    return [
      {
        eyebrow: 'Relación',
        title: 'Gestión y cliente',
        fields: this.fields(report, [
          'identificador',
          'solicitud_tiemposConsultores.nombreGestion',
          'solicitud',
          'solicitud_tiemposConsultores.tipoSolicitud',
          'solicitud_tiemposConsultores.prioridad',
          'solicitud_tiemposConsultores.solicitud_cliente.nombre',
        ]),
      },
      {
        eyebrow: 'Dedicación',
        title: 'Fecha y horas',
        fields: this.fields(report, [
          'fechaInicio',
          'HoraInicio',
          'HoraFin',
          'tiempoRealHoras',
          'tipoHora',
        ]),
      },
      {
        eyebrow: 'Actividad',
        title: 'Descripción reportada',
        fields: this.fields(report, [
          'descripcionActividad',
          'observacion',
          'tipoActividad',
          'categoria',
          'funcional',
        ]),
      },
    ].filter((section) => section.fields.length);
  }

  secondarySections(report: ManagementReport): DetailSection[] {
    return [
      {
        eyebrow: 'Clasificación',
        title: 'Campos avanzados',
        fields: this.fields(report, [
          'causa',
          'complejidad',
          'impacto',
          'equipo',
          'modoActuacion',
          'lenguaje',
          'prefijo',
          'objetoRicef',
          'ricef',
        ]),
      },
      {
        eyebrow: 'Soporte',
        title: 'Técnico y pruebas',
        fields: this.fields(report, [
          'modulo',
          'tecnologia',
          'proyecto',
          'fechaEstimadaPruebas',
          'fechaEstimadaRealPruebas',
        ]),
      },
      {
        eyebrow: 'Persona',
        title: 'Usuario asociado',
        fields: this.fields(report, [
          'consultor',
          'nombreConsultor',
          'usuario_tiemposConsultores.nombre',
          'usuario_tiemposConsultores.email',
        ]),
      },
    ].filter((section) => section.fields.length);
  }

  backendFields(report: ManagementReport): DetailField[] {
    return [
      this.fieldFromAliases(report, 'cliente', ['cliente']),
      this.fieldFromAliases(report, 'ricef', ['ricef']),
      this.fieldFromAliases(report, 'proyecto', ['proyecto']),
      this.fieldFromAliases(report, 'solicitud', [
        'solicitud_tiemposConsultores.nombreGestion',
        'solicitud',
        'gestionDemanda',
        'identificador',
      ]),
      this.fieldFromAliases(report, 'tipoActividad', ['tipoActividad']),
      this.fieldFromAliases(report, 'HoraInicio', ['HoraInicio']),
      this.fieldFromAliases(report, 'HoraFin', ['HoraFin']),
      this.fieldFromAliases(report, 'fechaInicio', ['fechaInicio']),
      this.fieldFromAliases(report, 'causa', ['causa']),
      this.fieldFromAliases(report, 'complejidad', ['complejidad']),
      this.fieldFromAliases(report, 'impacto', ['impacto']),
      this.fieldFromAliases(report, 'equipo', ['equipo']),
      this.fieldFromAliases(report, 'modoActuacion', ['modoActuacion']),
      this.fieldFromAliases(report, 'lenguaje', ['lenguaje']),
      this.fieldFromAliases(report, 'tipoHora', ['tipoHora']),
      this.fieldFromAliases(report, 'funcional', ['funcional']),
      this.fieldFromAliases(report, 'prefijo', ['prefijo']),
      this.fieldFromAliases(report, 'objetoRicef', ['objetoRicef']),
      this.fieldFromAliases(report, 'unity', ['unity', 'modulo']),
      this.fieldFromAliases(report, 'descripcionActividad', ['descripcionActividad']),
      this.fieldFromAliases(report, 'observacion', ['observacion']),
      this.fieldFromAliases(report, 'categoria', ['categoria']),
      this.fieldFromAliases(report, 'tiempoRealHoras', ['tiempoRealHoras']),
      this.fieldFromAliases(report, 'fechaEstimadaPruebas', [
        'fechaEstimadaPruebas',
        'fechaEstimada',
      ]),
      this.fieldFromAliases(report, 'fechaEstimadaRealPruebas', [
        'fechaEstimadaRealPruebas',
        'fechaReal',
      ]),
    ];
  }

  primaryBackendFields(report: ManagementReport): DetailField[] {
    return [
      this.fieldFromAliases(report, 'cliente', ['cliente']),
      this.fieldFromAliases(report, 'solicitud', [
        'solicitud_tiemposConsultores.nombreGestion',
        'solicitud',
        'gestionDemanda',
        'identificador',
      ]),
      this.fieldFromAliases(report, 'tipoHora', ['tipoHora']),
      this.fieldFromAliases(report, 'fechaInicio', ['fechaInicio']),
      this.fieldFromAliases(report, 'HoraInicio', ['HoraInicio']),
      this.fieldFromAliases(report, 'HoraFin', ['HoraFin']),
      this.fieldFromAliases(report, 'tiempoRealHoras', ['tiempoRealHoras']),
      this.fieldFromAliases(report, 'descripcionActividad', ['descripcionActividad']),
      this.fieldFromAliases(report, 'observacion', ['observacion']),
    ];
  }

  advancedBackendFields(report: ManagementReport): DetailField[] {
    return [
      this.fieldFromAliases(report, 'ricef', ['ricef']),
      this.fieldFromAliases(report, 'proyecto', ['proyecto']),
      this.fieldFromAliases(report, 'tipoActividad', ['tipoActividad']),
      this.fieldFromAliases(report, 'causa', ['causa']),
      this.fieldFromAliases(report, 'complejidad', ['complejidad']),
      this.fieldFromAliases(report, 'impacto', ['impacto']),
      this.fieldFromAliases(report, 'equipo', ['equipo']),
      this.fieldFromAliases(report, 'modoActuacion', ['modoActuacion']),
      this.fieldFromAliases(report, 'lenguaje', ['lenguaje']),
      this.fieldFromAliases(report, 'funcional', ['funcional']),
      this.fieldFromAliases(report, 'prefijo', ['prefijo']),
      this.fieldFromAliases(report, 'objetoRicef', ['objetoRicef']),
      this.fieldFromAliases(report, 'unity', ['unity', 'modulo']),
      this.fieldFromAliases(report, 'categoria', ['categoria']),
      this.fieldFromAliases(report, 'fechaEstimadaPruebas', [
        'fechaEstimadaPruebas',
        'fechaEstimada',
      ]),
      this.fieldFromAliases(report, 'fechaEstimadaRealPruebas', [
        'fechaEstimadaRealPruebas',
        'fechaReal',
      ]),
    ];
  }

  otherFields(report: ManagementReport): DetailField[] {
    return this.flatten(report)
      .filter(([path]) => !this.usedPrimaryPaths.has(path) && !this.usedSecondaryPaths.has(path))
      .map(([path, value]) => this.detailField(path, value));
  }

  display(value: unknown): string {
    if (value === undefined || value === null || value === '') return '--';
    if (Array.isArray(value)) return value.length ? JSON.stringify(value) : '--';
    return String(value);
  }

  private fields(report: ManagementReport, paths: string[]): DetailField[] {
    return paths
      .map((path) => this.detailField(path, this.valueAtPath(report, path)))
      .filter((field) => field.value !== '--');
  }

  private detailField(path: string, value: unknown): DetailField {
    return {
      key: path,
      label: this.labelByPath[path] || path,
      value: this.display(value),
    };
  }

  private fieldFromAliases(
    report: ManagementReport,
    canonicalPath: string,
    aliases: string[],
    fallback?: () => unknown,
  ): DetailField {
    const value = aliases
      .map((path) => this.valueAtPath(report, path))
      .find((item) => this.display(item) !== '--');
    return this.detailField(canonicalPath, value ?? fallback?.());
  }

  private valueAtPath(value: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, value);
  }

  private flatten(value: unknown, prefix = ''): [string, unknown][] {
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        return this.flatten(child, path);
      }
      return [[path, child] as [string, unknown]];
    });
  }

  private normalizeDateValue(value: string): string {
    if (!value || value === '0000-00-00') return '';
    const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
  }
}
