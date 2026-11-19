import type { AuthGateway } from '@application/auth/auth.gateway';
import { ManagementTemplateGateway } from '@application/time-records/ports/management-template.gateway';
import type {
  ManagementAdvancedTemplate,
  ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';
import type { Environment } from '@env/environment';
import type { HttpClient } from '../../http/http-client';
import { ManagementTemplateMapper, type TemplatePayload } from '../mappers/management-template.mapper';

/** Prefijo de la clave de localStorage por usuario (el mismo que la app Angular). */
export const MANAGEMENT_TEMPLATES_STORAGE_PREFIX = 'pmo_management_templates_v1';

const hasStatus = (error: unknown, status: number): boolean =>
  (error as { status?: unknown } | null)?.status === status;

/**
 * Plantillas de campos avanzados en Supabase con caché local por usuario. Si la sincronización falla
 * se usa la caché (salvo 403, que se relanza). Sin token/configuración, las operaciones rechazan con
 * "Sincronización no configurada" (en Angular era un throw síncrono antes del pipe).
 */
export class ManagementTemplateAdapter extends ManagementTemplateGateway {
  private readonly mapper = new ManagementTemplateMapper();
  private readonly known = new Map<string, ManagementDemandOption>();
  private readonly http: HttpClient;
  private readonly auth: AuthGateway;
  private readonly env: Environment;

  constructor(http: HttpClient, auth: AuthGateway, env: Environment) {
    super();
    this.http = http;
    this.auth = auth;
    this.env = env;
  }

  async list(): Promise<ManagementAdvancedTemplate[]> {
    const request = this.remoteGet();
    try {
      const payload = await request;
      const templates = this.mergeLocalControlData(this.mapper.many(payload.templates || []));
      this.persistLocal(templates);
      return templates;
    } catch {
      return this.loadLocal();
    }
  }

  async get(gestionId: string): Promise<ManagementAdvancedTemplate | null> {
    const id = String(gestionId || '').trim();
    if (!id) return null;
    const request = this.remoteGet(id);
    try {
      const payload = await request;
      return this.mergeOneWithLocal(this.mapper.one(payload.template || null));
    } catch {
      return this.loadLocal().find((item) => item.gestionId === id) || null;
    }
  }

  async save(template: ManagementAdvancedTemplate): Promise<ManagementAdvancedTemplate> {
    const sanitized = this.mapper.one(template);
    if (!sanitized) throw new Error('La plantilla de gestión no es válida.');
    const request = this.remotePost('POST', sanitized);
    try {
      const payload = await request;
      const saved = this.mergeTemplateControlData(this.mapper.one(payload.template || sanitized), sanitized);
      this.upsertLocal(saved);
      return saved;
    } catch (error) {
      if (hasStatus(error, 403)) throw error;
      this.upsertLocal(sanitized);
      return sanitized;
    }
  }

  async remove(gestionId: string): Promise<void> {
    const request = this.remotePost('DELETE', { gestionId });
    try {
      await request;
      this.removeLocal(gestionId);
    } catch (error) {
      if (hasStatus(error, 403)) throw error;
      this.removeLocal(gestionId);
    }
  }

  registerKnownManagement(option: ManagementDemandOption): void {
    if (!option.id) return;
    this.known.set(option.id, option);
  }

  knownManagement(gestionId: string): ManagementDemandOption | null {
    return this.known.get(gestionId) || null;
  }

  /** Lanza de forma síncrona si no hay configuración (fuera del try de quien llama, como en Angular). */
  private remoteGet(gestionId?: string): Promise<TemplatePayload> {
    if (!this.configured()) throw new Error('Sincronización no configurada');
    const params = gestionId ? `?gestionId=${encodeURIComponent(gestionId)}` : '';
    return this.http.get<TemplatePayload>(
      `${this.env.supabaseUrl}/functions/v1/pmo-management-templates${params}`,
      { headers: this.headers },
    );
  }

  private remotePost(
    method: 'POST' | 'DELETE',
    body: Partial<ManagementAdvancedTemplate> | { gestionId: string },
  ): Promise<TemplatePayload> {
    if (!this.configured()) throw new Error('Sincronización no configurada');
    return this.http.request<TemplatePayload>(
      method,
      `${this.env.supabaseUrl}/functions/v1/pmo-management-templates`,
      { headers: this.headers, body },
    );
  }

  private get headers(): Record<string, string> {
    return {
      apikey: this.env.supabasePublishableKey,
      Authorization: `Bearer ${this.auth.token || ''}`,
      'Content-Type': 'application/json',
    };
  }

  private configured(): boolean {
    return !!this.env.supabaseUrl && !!this.env.supabasePublishableKey && !!this.auth.token;
  }

  private loadLocal(): ManagementAdvancedTemplate[] {
    try {
      return this.mapper.many(
        JSON.parse(localStorage.getItem(this.storageKey()) || '[]') as ManagementAdvancedTemplate[],
      );
    } catch {
      localStorage.removeItem(this.storageKey());
      return [];
    }
  }

  private persistLocal(templates: ManagementAdvancedTemplate[]): void {
    localStorage.setItem(this.storageKey(), JSON.stringify(this.mapper.many(templates)));
  }

  private upsertLocal(template: ManagementAdvancedTemplate): void {
    const templates = this.loadLocal().filter((item) => item.gestionId !== template.gestionId);
    this.persistLocal([...templates, template]);
  }

  private mergeLocalControlData(templates: ManagementAdvancedTemplate[]): ManagementAdvancedTemplate[] {
    const local = new Map(this.loadLocal().map((item) => [item.gestionId, item]));
    return templates.map((template) => this.mergeTemplateControlData(template, local.get(template.gestionId)));
  }

  private mergeOneWithLocal(template: ManagementAdvancedTemplate | null): ManagementAdvancedTemplate | null {
    if (!template) return null;
    const local = this.loadLocal().find((item) => item.gestionId === template.gestionId);
    return this.mergeTemplateControlData(template, local);
  }

  private mergeTemplateControlData(
    template: ManagementAdvancedTemplate | null,
    fallback: ManagementAdvancedTemplate | undefined | null,
  ): ManagementAdvancedTemplate {
    const base = template || fallback;
    if (!base) throw new Error('La plantilla de gestión no es válida.');
    return {
      ...base,
      client: base.client || fallback?.client,
      project: base.project || fallback?.project,
    };
  }

  private removeLocal(gestionId: string): void {
    this.persistLocal(this.loadLocal().filter((item) => item.gestionId !== gestionId));
  }

  private storageKey(): string {
    const user = this.auth.user();
    const identity = String(user?.id || user?.email || 'anonymous')
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, '_');
    return `${MANAGEMENT_TEMPLATES_STORAGE_PREFIX}_${identity}`;
  }
}
