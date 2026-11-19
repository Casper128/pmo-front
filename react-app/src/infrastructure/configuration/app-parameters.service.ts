import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import type { AuthGateway } from '@application/auth/auth.gateway';
import type {
  AdvancedFieldConfiguration,
  AdvancedFieldKey,
  DeletionSettings,
  ParameterOption,
  WorkSettings,
} from '@domain/configuration/app-parameters.model';
import type { Environment } from '@env/environment';
import type { FetchFn } from '../http/http-client';

interface SupabaseOptionRow {
  field_key: string;
  option_value: string;
  option_label?: string;
  active?: boolean;
  sort_order?: number;
  is_default?: boolean;
}

interface SupabaseSettingsRow {
  monday_thursday_hours: number | string;
  friday_hours: number | string;
  daily_hours?: Record<number, number>;
  dailyHours?: Record<number, number>;
  max_daily_labor_hours: number | string;
  max_hours_per_record: number | string;
}

interface ConfigurationPayload {
  isAdmin?: boolean;
  fields?: AdvancedFieldConfiguration[];
  optionRows?: SupabaseOptionRow[];
  workSettings?: SupabaseSettingsRow;
  deletionSettings?: Partial<DeletionSettings>;
}

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

interface AppParametersState {
  fields: AdvancedFieldConfiguration[];
  workSettings: WorkSettings;
  deletionSettings: DeletionSettings;
  loading: boolean;
  saving: boolean;
  error: string;
  source: 'supabase' | 'local';
  serverAdminAccess: boolean;
}

/**
 * Port de `AppParametersService` (Angular): los signals se sustituyen por un estado inmutable con
 * `subscribe`/`notify`. Mismo endpoint Supabase, cabeceras, timeout de 12 s, mensajes, saneado,
 * fallback local y clave de almacenamiento. Como en Angular, el constructor carga lo local y lanza
 * `load()`.
 */
export class AppParametersService extends AppParametersFacade {
  private readonly auth: AuthGateway;
  private readonly env: Environment;
  private readonly fetchFn: FetchFn;
  private readonly listeners = new Set<() => void>();
  private activeLoads = 0;
  private state: AppParametersState;

  readonly fields = (): AdvancedFieldConfiguration[] => this.state.fields;
  readonly workSettings = (): WorkSettings => this.state.workSettings;
  readonly deletionSettings = (): DeletionSettings => this.state.deletionSettings;
  readonly loading = (): boolean => this.state.loading;
  readonly saving = (): boolean => this.state.saving;
  readonly error = (): string => this.state.error;
  readonly source = (): 'supabase' | 'local' => this.state.source;
  readonly configured = (): boolean => !!this.env.supabaseUrl && !!this.env.supabasePublishableKey;
  readonly canManage = (): boolean => {
    const email = this.normalize(this.auth.user()?.email);
    return (
      this.state.serverAdminAccess ||
      this.env.configurationAdminEmails.some((admin) => this.normalize(admin) === email)
    );
  };

  constructor(
    auth: AuthGateway,
    env: Environment,
    fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init),
  ) {
    super();
    this.auth = auth;
    this.env = env;
    this.fetchFn = fetchFn;
    this.state = {
      fields: cloneFields(DEFAULT_ADVANCED_FIELDS),
      workSettings: { ...DEFAULT_WORK_SETTINGS },
      deletionSettings: this.defaultDeletionSettings(),
      loading: false,
      saving: false,
      error: '',
      source: 'local',
      serverAdminAccess: false,
    };
    this.loadLocal();
    void this.load();
  }

  /** Notifica cambios propios y del usuario autenticado (del que depende `canManage`). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const unsubscribeAuth = this.auth.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      unsubscribeAuth();
    };
  }

  async load(): Promise<void> {
    this.setState({
      serverAdminAccess: false,
      fields: cloneFields(DEFAULT_ADVANCED_FIELDS),
      workSettings: { ...DEFAULT_WORK_SETTINGS },
      deletionSettings: this.defaultDeletionSettings(),
    });
    this.loadLocal();
    if (!this.configured() || !this.auth.token) return;
    this.activeLoads += 1;
    this.setState({ loading: true, error: '' });
    try {
      const response = await this.fetchWithTimeout(this.endpoint(), {
        method: 'GET',
        headers: {
          apikey: this.env.supabasePublishableKey,
          Authorization: `Bearer ${this.auth.token}`,
        },
      });
      if (!response.ok) throw new Error(await this.responseError(response));
      const payload = (await response.json()) as ConfigurationPayload | null;
      this.setState({ serverAdminAccess: payload?.isAdmin === true });
      const next: Partial<AppParametersState> = {};
      if (payload?.optionRows?.length) {
        next.fields = this.mergeRows(payload.optionRows);
      } else if (Array.isArray(payload?.fields) && payload.fields.length) {
        next.fields = this.sanitizeFields(payload.fields);
      }
      const settings = payload?.workSettings;
      if (settings) {
        next.workSettings = this.sanitizeSettings({
          mondayThursdayHours: Number(settings.monday_thursday_hours),
          fridayHours: Number(settings.friday_hours),
          dailyHours: settings.dailyHours || settings.daily_hours || DEFAULT_WORK_SETTINGS.dailyHours,
          maxDailyLaborHours: Number(settings.max_daily_labor_hours),
          maxHoursPerRecord: Number(settings.max_hours_per_record),
        });
      }
      next.deletionSettings = this.sanitizeDeletionSettings(payload?.deletionSettings);
      next.source = 'supabase';
      this.setState(next);
      this.persistLocal();
    } catch (error) {
      this.setState({
        source: 'local',
        error:
          `Sincronización no disponible; se usan parámetros locales. ${error instanceof Error ? error.message : ''}`.trim(),
      });
    } finally {
      this.activeLoads = Math.max(0, this.activeLoads - 1);
      this.setState({ loading: this.activeLoads > 0 });
    }
  }

  optionsFor(key: AdvancedFieldKey): ParameterOption[] {
    return (this.fields().find((field) => field.key === key)?.options || [])
      .filter((item) => item.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  valuesFor(key: AdvancedFieldKey): string[] {
    return this.optionsFor(key).map((item) => item.value);
  }

  defaultFor(key: AdvancedFieldKey): string {
    return this.fields().find((field) => field.key === key)?.defaultValue || '';
  }

  defaults(): Record<AdvancedFieldKey, string> {
    return Object.fromEntries(this.fields().map((field) => [field.key, field.defaultValue])) as Record<
      AdvancedFieldKey,
      string
    >;
  }

  canUseTechnicalDelete(email = this.auth.user()?.email): boolean {
    const normalized = this.normalize(email);
    return this.deletionSettings().technicalDeleteEmails.some(
      (item) => this.normalize(item) === normalized,
    );
  }

  async save(
    fields: AdvancedFieldConfiguration[],
    workSettings: WorkSettings,
    deletionSettings: DeletionSettings,
  ): Promise<void> {
    if (!this.canManage()) throw new Error('Solo el administrador puede guardar la configuración global.');
    this.setState({ saving: true, error: '' });
    try {
      const normalizedFields = this.sanitizeFields(fields);
      const normalizedSettings = this.sanitizeSettings(workSettings);
      const normalizedDeletionSettings = this.sanitizeDeletionSettings(deletionSettings);
      let source: 'supabase' | 'local';
      if (this.configured()) {
        const token = this.auth.token;
        if (!token) throw new Error('La sesión PMO no está disponible.');
        const response = await this.fetchWithTimeout(this.endpoint(), {
          method: 'POST',
          headers: {
            apikey: this.env.supabasePublishableKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: normalizedFields,
            workSettings: normalizedSettings,
            deletionSettings: normalizedDeletionSettings,
          }),
        });
        if (!response.ok) throw new Error(await this.responseError(response));
        source = 'supabase';
      } else {
        source = 'local';
      }
      this.setState({
        source,
        fields: normalizedFields,
        workSettings: normalizedSettings,
        deletionSettings: normalizedDeletionSettings,
      });
      this.persistLocal();
    } finally {
      this.setState({ saving: false });
    }
  }

  resetLocal(): void {
    if (!this.canManage()) return;
    this.setState({
      fields: cloneFields(DEFAULT_ADVANCED_FIELDS),
      workSettings: { ...DEFAULT_WORK_SETTINGS },
      deletionSettings: this.defaultDeletionSettings(),
    });
    this.persistLocal();
  }

  /** Ajustes de eliminación por defecto: el auditor sale de `VITE_DEFAULT_AUDITOR_EMAIL` (vacío si falta). */
  private defaultDeletionSettings(): DeletionSettings {
    return { auditorEmail: this.env.defaultAuditorEmail, technicalDeleteEmails: [] };
  }

  private setState(patch: Partial<AppParametersState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  private endpoint(): string {
    return `${this.env.supabaseUrl}/functions/v1/pmo-config-admin`;
  }

  private mergeRows(rows: SupabaseOptionRow[]): AdvancedFieldConfiguration[] {
    return DEFAULT_ADVANCED_FIELDS.map((base) => {
      const fieldRows = rows.filter((row) => row.field_key === base.key);
      if (!fieldRows.length) return cloneField(base);
      return {
        key: base.key,
        label: base.label,
        defaultValue: String(
          fieldRows.find((row) => row.is_default)?.option_value ||
            fieldRows[0].option_value ||
            base.defaultValue,
        ),
        options: fieldRows.map((row) => ({
          value: String(row.option_value),
          label: String(row.option_label || row.option_value),
          active: row.active !== false,
          sortOrder: Number(row.sort_order || 0),
        })),
      };
    });
  }

  private sanitizeFields(fields: AdvancedFieldConfiguration[]): AdvancedFieldConfiguration[] {
    return DEFAULT_ADVANCED_FIELDS.map((base) => {
      const incoming = fields.find((field) => field.key === base.key) || base;
      const options = incoming.options
        .map((item, index) => ({
          value: item.value.trim(),
          label: (item.label || item.value).trim(),
          active: item.active,
          sortOrder: index,
        }))
        .filter((item) => item.value);
      const defaultValue = options.some((item) => item.active && item.value === incoming.defaultValue)
        ? incoming.defaultValue
        : options.find((item) => item.active)?.value || '';
      return { key: base.key, label: base.label, defaultValue, options };
    });
  }

  private sanitizeSettings(value: WorkSettings): WorkSettings {
    const boundedNumber = (current: unknown, fallback: number, minimum: number) => {
      const numericValue = Number(current);
      if (!Number.isFinite(numericValue) || numericValue < minimum) return fallback;
      return Math.min(numericValue, 24);
    };
    const legacyMondayThursday = boundedNumber(
      value.mondayThursdayHours,
      DEFAULT_WORK_SETTINGS.mondayThursdayHours,
      0,
    );
    const legacyFriday = boundedNumber(value.fridayHours, DEFAULT_WORK_SETTINGS.fridayHours, 0);
    const sourceDaily = value.dailyHours || {};
    const dailyHours = Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((day) => [
        day,
        boundedNumber(
          sourceDaily[day],
          day === 0 || day === 6 ? 0 : day === 5 ? legacyFriday : legacyMondayThursday,
          0,
        ),
      ]),
    ) as Record<number, number>;
    return {
      mondayThursdayHours: dailyHours[1],
      fridayHours: dailyHours[5],
      dailyHours,
      maxDailyLaborHours: boundedNumber(value.maxDailyLaborHours, DEFAULT_WORK_SETTINGS.maxDailyLaborHours, 1),
      maxHoursPerRecord: boundedNumber(value.maxHoursPerRecord, DEFAULT_WORK_SETTINGS.maxHoursPerRecord, 1),
    };
  }

  private sanitizeDeletionSettings(value: Partial<DeletionSettings> | null | undefined): DeletionSettings {
    const emails = value?.technicalDeleteEmails;
    const technicalDeleteEmails = Array.from(
      new Set(
        (Array.isArray(emails) ? emails : [])
          .map((item) =>
            String(item || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    return {
      auditorEmail: String(value?.auditorEmail || this.env.defaultAuditorEmail)
        .trim()
        .toLowerCase(),
      technicalDeleteEmails,
    };
  }

  private loadLocal(): void {
    try {
      const stored = JSON.parse(localStorage.getItem(APP_PARAMETERS_STORAGE_KEY) || 'null') as {
        fields?: AdvancedFieldConfiguration[];
        workSettings?: WorkSettings;
        deletionSettings?: Partial<DeletionSettings>;
      } | null;
      const next: Partial<AppParametersState> = {};
      if (stored?.fields) next.fields = this.sanitizeFields(stored.fields);
      if (stored?.workSettings) next.workSettings = this.sanitizeSettings(stored.workSettings);
      if (stored?.deletionSettings) next.deletionSettings = this.sanitizeDeletionSettings(stored.deletionSettings);
      if (Object.keys(next).length) this.setState(next);
    } catch {
      localStorage.removeItem(APP_PARAMETERS_STORAGE_KEY);
    }
  }

  private persistLocal(): void {
    localStorage.setItem(
      APP_PARAMETERS_STORAGE_KEY,
      JSON.stringify({
        fields: this.fields(),
        workSettings: this.workSettings(),
        deletionSettings: this.deletionSettings(),
      }),
    );
  }

  private normalize(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('La sincronización tardó demasiado en responder.', { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async responseError(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { error?: string; message?: string } | null;
      return body?.error || body?.message || `La sincronización respondió ${response.status}`;
    } catch {
      return `La sincronización respondió ${response.status}`;
    }
  }
}

function cloneFields(fields: AdvancedFieldConfiguration[]): AdvancedFieldConfiguration[] {
  return fields.map((field) => cloneField(field));
}

function cloneField(field: AdvancedFieldConfiguration): AdvancedFieldConfiguration {
  return { ...field, options: field.options.map((item) => ({ ...item })) };
}
