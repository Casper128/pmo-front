import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthGateway } from '@application/auth/auth.gateway';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { environment } from '@env/environment';
import {
  AdvancedFieldConfiguration,
  AdvancedFieldKey,
  ParameterOption,
  WorkSettings,
} from '@domain/configuration/app-parameters.model';

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
  max_daily_labor_hours: number | string;
  max_hours_per_record: number | string;
}

interface ConfigurationPayload {
  isAdmin?: boolean;
  fields?: AdvancedFieldConfiguration[];
  optionRows?: SupabaseOptionRow[];
  workSettings?: SupabaseSettingsRow;
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
      'Configuración',
      'Escenario No Probado',
      'Escenario No Contemplado',
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
      'Logístico',
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
    options: options(['interfases', 'Reportes', 'Conversiones', 'Enhacement', 'Formularios']),
  },
  {
    key: 'categoria',
    label: 'Categoría',
    defaultValue: 'Operacion',
    options: options(['Everest', 'Operacion', 'Proyecto', 'Coordinacion']),
  },
];

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  mondayThursdayHours: 9,
  fridayHours: 8,
  maxDailyLaborHours: 10,
  maxHoursPerRecord: 16,
};

@Injectable()
export class AppParametersService extends AppParametersFacade {
  private auth = inject(AuthGateway);
  private readonly storagePrefix = 'pmo_app_parameters_v2';
  private activeLoads = 0;

  fields = signal<AdvancedFieldConfiguration[]>(this.cloneFields(DEFAULT_ADVANCED_FIELDS));
  workSettings = signal<WorkSettings>({ ...DEFAULT_WORK_SETTINGS });
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  source = signal<'supabase' | 'local'>('local');
  private serverAdminAccess = signal(false);
  configured = computed(() => !!environment.supabaseUrl && !!environment.supabasePublishableKey);
  canManage = computed(() => {
    const email = this.normalize(this.auth.user()?.email);
    return (
      this.serverAdminAccess() ||
      environment.configurationAdminEmails.some((admin) => this.normalize(admin) === email)
    );
  });

  constructor() {
    super();
    this.loadLocal();
    void this.load();
  }

  async load(): Promise<void> {
    this.serverAdminAccess.set(false);
    this.fields.set(this.cloneFields(DEFAULT_ADVANCED_FIELDS));
    this.workSettings.set({ ...DEFAULT_WORK_SETTINGS });
    this.loadLocal();
    if (!this.configured() || !this.auth.token) return;
    this.activeLoads += 1;
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.fetchWithTimeout(
        `${environment.supabaseUrl}/functions/v1/pmo-config-admin`,
        {
          method: 'GET',
          headers: {
            apikey: environment.supabasePublishableKey,
            Authorization: `Bearer ${this.auth.token}`,
          },
        },
      );
      if (!response.ok) throw new Error(await this.responseError(response));
      const payload = (await response.json()) as ConfigurationPayload;
      this.serverAdminAccess.set(payload?.isAdmin === true);
      if (Array.isArray(payload?.fields) && payload.fields.length) {
        this.fields.set(this.sanitizeFields(payload.fields));
      } else if (payload?.optionRows?.length) {
        this.fields.set(this.mergeRows(payload.optionRows));
      }
      const settings = payload?.workSettings;
      if (settings) {
        this.workSettings.set({
          mondayThursdayHours: Number(settings.monday_thursday_hours),
          fridayHours: Number(settings.friday_hours),
          maxDailyLaborHours: Number(settings.max_daily_labor_hours),
          maxHoursPerRecord: Number(settings.max_hours_per_record),
        });
      }
      this.source.set('supabase');
      this.persistLocal();
    } catch (error) {
      this.source.set('local');
      this.error.set(
        `Supabase no disponible; se usan parámetros locales. ${error instanceof Error ? error.message : ''}`.trim(),
      );
    } finally {
      this.activeLoads = Math.max(0, this.activeLoads - 1);
      this.loading.set(this.activeLoads > 0);
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
    return Object.fromEntries(
      this.fields().map((field) => [field.key, field.defaultValue]),
    ) as Record<AdvancedFieldKey, string>;
  }

  async save(fields: AdvancedFieldConfiguration[], workSettings: WorkSettings): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const normalizedFields = this.sanitizeFields(fields);
      const normalizedSettings = this.sanitizeSettings(workSettings);
      if (this.configured()) {
        const token = this.auth.token;
        if (!token) throw new Error('La sesión PMO no está disponible.');
        const response = await this.fetchWithTimeout(
          `${environment.supabaseUrl}/functions/v1/pmo-config-admin`,
          {
            method: 'POST',
            headers: {
              apikey: environment.supabasePublishableKey,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: normalizedFields,
              ...(this.canManage() ? { workSettings: normalizedSettings } : {}),
            }),
          },
        );
        if (!response.ok) throw new Error(await this.responseError(response));
        this.source.set('supabase');
      } else {
        this.source.set('local');
      }
      this.fields.set(normalizedFields);
      if (this.canManage()) this.workSettings.set(normalizedSettings);
      this.persistLocal();
    } finally {
      this.saving.set(false);
    }
  }

  resetLocal(): void {
    this.fields.set(this.cloneFields(DEFAULT_ADVANCED_FIELDS));
    if (this.canManage()) this.workSettings.set({ ...DEFAULT_WORK_SETTINGS });
    this.persistLocal();
  }

  private mergeRows(rows: SupabaseOptionRow[]): AdvancedFieldConfiguration[] {
    return DEFAULT_ADVANCED_FIELDS.map((base) => {
      const fieldRows = rows.filter((row) => row.field_key === base.key);
      if (!fieldRows.length) return this.cloneField(base);
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
      const defaultValue = options.some(
        (item) => item.active && item.value === incoming.defaultValue,
      )
        ? incoming.defaultValue
        : options.find((item) => item.active)?.value || '';
      return { key: base.key, label: base.label, defaultValue, options };
    });
  }

  private sanitizeSettings(value: WorkSettings): WorkSettings {
    const number = (current: number, fallback: number) =>
      Number.isFinite(Number(current)) && Number(current) > 0 ? Number(current) : fallback;
    return {
      mondayThursdayHours: number(
        value.mondayThursdayHours,
        DEFAULT_WORK_SETTINGS.mondayThursdayHours,
      ),
      fridayHours: number(value.fridayHours, DEFAULT_WORK_SETTINGS.fridayHours),
      maxDailyLaborHours: number(
        value.maxDailyLaborHours,
        DEFAULT_WORK_SETTINGS.maxDailyLaborHours,
      ),
      maxHoursPerRecord: number(value.maxHoursPerRecord, DEFAULT_WORK_SETTINGS.maxHoursPerRecord),
    };
  }

  private loadLocal(): void {
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey()) || 'null');
      if (stored?.fields) this.fields.set(this.sanitizeFields(stored.fields));
      if (stored?.workSettings) this.workSettings.set(this.sanitizeSettings(stored.workSettings));
    } catch {
      localStorage.removeItem(this.storageKey());
    }
  }

  private persistLocal(): void {
    localStorage.setItem(
      this.storageKey(),
      JSON.stringify({ fields: this.fields(), workSettings: this.workSettings() }),
    );
  }

  private storageKey(): string {
    const user = this.auth.user();
    const identity = this.normalize(user?.id || user?.email || 'anonymous').replace(
      /[^a-z0-9@._-]/g,
      '_',
    );
    return `${this.storagePrefix}_${identity}`;
  }

  private cloneFields(fields: AdvancedFieldConfiguration[]): AdvancedFieldConfiguration[] {
    return fields.map((field) => this.cloneField(field));
  }

  private cloneField(field: AdvancedFieldConfiguration): AdvancedFieldConfiguration {
    return { ...field, options: field.options.map((item) => ({ ...item })) };
  }

  private normalize(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = 12000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Supabase tardó demasiado en responder.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async responseError(response: Response): Promise<string> {
    try {
      const body = await response.json();
      return body?.error || body?.message || `Supabase respondió ${response.status}`;
    } catch {
      return `Supabase respondió ${response.status}`;
    }
  }
}
