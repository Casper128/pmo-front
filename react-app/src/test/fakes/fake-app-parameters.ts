import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import type {
  AdvancedFieldConfiguration,
  AdvancedFieldKey,
  DeletionSettings,
  ParameterOption,
  WorkSettings,
} from '@domain/configuration/app-parameters.model';
import type { AuthGateway } from '@application/auth/auth.gateway';

export interface FakeParametersState {
  canManage: boolean;
  loading: boolean;
  deletionSettings: DeletionSettings;
  fields: AdvancedFieldConfiguration[];
  workSettings: WorkSettings;
}

/** Referencia estable: `useSyncExternalStore` exige que `fields()` devuelva el mismo array entre llamadas. */
const NO_FIELDS: AdvancedFieldConfiguration[] = [];

const defaultWorkSettings: WorkSettings = {
  mondayThursdayHours: 8.5,
  fridayHours: 8,
  dailyHours: { 0: 0, 1: 8.5, 2: 8.5, 3: 8.5, 4: 8.5, 5: 8, 6: 0 },
  maxDailyLaborHours: 10,
  maxHoursPerRecord: 16,
};

/**
 * Doble de `AppParametersFacade` con estado controlable (`set`) y notificación a suscriptores. Como el
 * servicio real, también notifica los cambios del usuario autenticado si recibe un `AuthGateway`.
 */
export class FakeAppParameters extends AppParametersFacade {
  private readonly listeners = new Set<() => void>();
  private readonly auth: AuthGateway | null;
  private state: FakeParametersState;

  readonly fields = (): AdvancedFieldConfiguration[] => this.state.fields;
  readonly workSettings = (): WorkSettings => this.state.workSettings;
  readonly deletionSettings = (): DeletionSettings => this.state.deletionSettings;
  readonly loading = (): boolean => this.state.loading;
  readonly saving = (): boolean => false;
  readonly error = (): string => '';
  readonly source = (): 'supabase' | 'local' => 'local';
  readonly configured = (): boolean => true;
  readonly canManage = (): boolean => this.state.canManage;

  constructor(initial: Partial<FakeParametersState> = {}, auth: AuthGateway | null = null) {
    super();
    this.auth = auth;
    this.state = {
      canManage: false,
      loading: false,
      deletionSettings: { auditorEmail: 'auditor@example.test', technicalDeleteEmails: [] },
      fields: NO_FIELDS,
      workSettings: defaultWorkSettings,
      ...initial,
    };
  }

  set(patch: Partial<FakeParametersState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const unsubscribeAuth = this.auth?.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      unsubscribeAuth?.();
    };
  }

  async load(): Promise<void> {}

  optionsFor(key: AdvancedFieldKey): ParameterOption[] {
    return (this.state.fields.find((field) => field.key === key)?.options || [])
      .filter((item) => item.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  valuesFor(key: AdvancedFieldKey): string[] {
    return this.optionsFor(key).map((item) => item.value);
  }

  defaultFor(key: AdvancedFieldKey): string {
    return this.state.fields.find((field) => field.key === key)?.defaultValue || '';
  }

  defaults(): Record<AdvancedFieldKey, string> {
    return Object.fromEntries(this.state.fields.map((field) => [field.key, field.defaultValue])) as Record<
      AdvancedFieldKey,
      string
    >;
  }

  canUseTechnicalDelete(email?: string): boolean {
    const normalized = String(email || '').trim().toLowerCase();
    return this.state.deletionSettings.technicalDeleteEmails.includes(normalized);
  }

  async save(): Promise<void> {}

  resetLocal(): void {}
}

const option = (value: string, sortOrder: number): ParameterOption => ({ value, label: value, active: true, sortOrder });

/** Parámetros configurables ficticios: tipos de hora y los selects obligatorios de la plantilla. */
export function testParameterFields(): AdvancedFieldConfiguration[] {
  const field = (key: AdvancedFieldKey, label: string, values: string[], defaultValue = ''): AdvancedFieldConfiguration => ({
    key,
    label,
    defaultValue,
    options: values.map((value, index) => option(value, index)),
  });
  return [
    field('tipoHora', 'Tipo hora', ['Laboral', 'Fábrica', 'No facturable'], 'Laboral'),
    field('tipoActividad', 'Tipo actividad', ['Desarrollo', 'Soporte'], 'Desarrollo'),
    field('causa', 'Causa', ['Nuevo requerimiento', 'Error']),
    field('complejidad', 'Complejidad', ['Baja', 'Media']),
    field('impacto', 'Impacto', ['Bajo', 'Alto']),
    field('equipo', 'Equipo', ['Equipo A', 'Equipo B']),
    field('modoActuacion', 'Modo actuación', ['Correctivo', 'Evolutivo']),
    field('lenguaje', 'Lenguaje', ['ABAP', 'Java']),
    field('prefijo', 'Prefijo', ['Z', 'Y']),
    field('objetoRicef', 'RICEF object', ['Reporte', 'Interfaz']),
    field('categoria', 'Categoría', ['Mantenimiento', 'Proyecto']),
  ];
}
