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
}

const workSettings: WorkSettings = {
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

  readonly fields = (): AdvancedFieldConfiguration[] => [];
  readonly workSettings = (): WorkSettings => workSettings;
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

  optionsFor(): ParameterOption[] {
    return [];
  }

  valuesFor(): string[] {
    return [];
  }

  defaultFor(): string {
    return '';
  }

  defaults(): Record<AdvancedFieldKey, string> {
    return {} as Record<AdvancedFieldKey, string>;
  }

  canUseTechnicalDelete(email?: string): boolean {
    const normalized = String(email || '').trim().toLowerCase();
    return this.state.deletionSettings.technicalDeleteEmails.includes(normalized);
  }

  async save(): Promise<void> {}

  resetLocal(): void {}
}
