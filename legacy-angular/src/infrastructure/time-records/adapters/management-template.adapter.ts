import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { ManagementTemplateGateway } from '@application/time-records/ports/management-template.gateway';
import { AuthGateway } from '@application/auth/auth.gateway';
import { environment } from '@env/environment';
import {
  ManagementAdvancedTemplate,
  ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';
import { ManagementTemplateMapper, TemplatePayload } from '../mappers/management-template.mapper';

@Injectable()
export class ManagementTemplateAdapter extends ManagementTemplateGateway {
  private readonly storagePrefix = 'pmo_management_templates_v1';
  private readonly mapper = new ManagementTemplateMapper();
  private known = new Map<string, ManagementDemandOption>();

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthGateway,
  ) {
    super();
  }

  list(): Observable<ManagementAdvancedTemplate[]> {
    return this.remoteGet().pipe(
      map((payload) => this.mergeLocalControlData(this.mapper.many(payload.templates || []))),
      tap((templates) => this.persistLocal(templates)),
      catchError(() => of(this.loadLocal())),
    );
  }

  get(gestionId: string): Observable<ManagementAdvancedTemplate | null> {
    const id = String(gestionId || '').trim();
    if (!id) return of(null);
    return this.remoteGet(id).pipe(
      map((payload) => this.mergeOneWithLocal(this.mapper.one(payload.template || null))),
      catchError(() => of(this.loadLocal().find((item) => item.gestionId === id) || null)),
    );
  }

  save(template: ManagementAdvancedTemplate): Observable<ManagementAdvancedTemplate> {
    const sanitized = this.mapper.one(template);
    if (!sanitized) throw new Error('La plantilla de gestión no es válida.');
    return this.remotePost('POST', sanitized).pipe(
      map((payload) =>
        this.mergeTemplateControlData(this.mapper.one(payload.template || sanitized), sanitized),
      ),
      tap((saved) => this.upsertLocal(saved)),
      catchError((error) => {
        if (error?.status === 403) return throwError(() => error);
        this.upsertLocal(sanitized);
        return of(sanitized);
      }),
    );
  }

  remove(gestionId: string): Observable<void> {
    return this.remotePost('DELETE', { gestionId }).pipe(
      map(() => undefined),
      tap(() => this.removeLocal(gestionId)),
      catchError((error) => {
        if (error?.status === 403) return throwError(() => error);
        this.removeLocal(gestionId);
        return of(undefined);
      }),
    );
  }

  registerKnownManagement(option: ManagementDemandOption): void {
    if (!option.id) return;
    this.known.set(option.id, option);
  }

  knownManagement(gestionId: string): ManagementDemandOption | null {
    return this.known.get(gestionId) || null;
  }

  private remoteGet(gestionId?: string): Observable<TemplatePayload> {
    if (!this.configured()) throw new Error('Sincronización no configurada');
    const params = gestionId ? `?gestionId=${encodeURIComponent(gestionId)}` : '';
    return this.http.get<TemplatePayload>(
      `${environment.supabaseUrl}/functions/v1/pmo-management-templates${params}`,
      { headers: this.headers },
    );
  }

  private remotePost(
    method: 'POST' | 'DELETE',
    body: Partial<ManagementAdvancedTemplate> | { gestionId: string },
  ): Observable<TemplatePayload> {
    if (!this.configured()) throw new Error('Sincronización no configurada');
    return this.http.request<TemplatePayload>(
      method,
      `${environment.supabaseUrl}/functions/v1/pmo-management-templates`,
      { headers: this.headers, body },
    );
  }

  private get headers(): Record<string, string> {
    return {
      apikey: environment.supabasePublishableKey,
      Authorization: `Bearer ${this.auth.token || ''}`,
      'Content-Type': 'application/json',
    };
  }

  private configured(): boolean {
    return !!environment.supabaseUrl && !!environment.supabasePublishableKey && !!this.auth.token;
  }

  private loadLocal(): ManagementAdvancedTemplate[] {
    try {
      return this.mapper.many(JSON.parse(localStorage.getItem(this.storageKey()) || '[]'));
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

  private mergeLocalControlData(
    templates: ManagementAdvancedTemplate[],
  ): ManagementAdvancedTemplate[] {
    const local = new Map(this.loadLocal().map((item) => [item.gestionId, item]));
    return templates.map((template) =>
      this.mergeTemplateControlData(template, local.get(template.gestionId)),
    );
  }

  private mergeOneWithLocal(
    template: ManagementAdvancedTemplate | null,
  ): ManagementAdvancedTemplate | null {
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
    return `${this.storagePrefix}_${identity}`;
  }
}
