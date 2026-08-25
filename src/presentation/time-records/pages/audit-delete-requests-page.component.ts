import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { AuthGateway } from '@application/auth/auth.gateway';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { ManagementDeleteRequestGateway } from '@application/time-records/ports/management-delete-request.gateway';
import { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import { UiPageHeaderComponent } from '@presentation/shared/components/ui-page-header/ui-page-header.component';
import { UiStateMessageComponent } from '@presentation/shared/components/ui-state-message/ui-state-message.component';

@Component({
  selector: 'app-audit-delete-requests-page',
  standalone: true,
  imports: [CommonModule, DatePipe, UiPageHeaderComponent, UiStateMessageComponent],
  templateUrl: './audit-delete-requests-page.component.html',
})
export class AuditDeleteRequestsPageComponent implements OnInit {
  private readonly requestsGateway = inject(ManagementDeleteRequestGateway);
  private readonly management = inject(TimeManagementGateway);
  private readonly auth = inject(AuthGateway);
  readonly parameters = inject(AppParametersFacade);

  readonly loading = signal(false);
  readonly actionId = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly requests = signal<ManagementDeleteRequest[]>([]);
  readonly pendingRequests = computed(() =>
    this.requests()
      .filter((request) => request.status === 'pending')
      .sort((a, b) => this.dateValue(b.requestedAt) - this.dateValue(a.requestedAt)),
  );
  readonly canReview = computed(() => {
    const user = this.auth.user();
    const identities = [user?.email, user?.username].map((value) => this.normalizeEmail(value));
    const auditor = this.normalizeEmail(this.parameters.deletionSettings().auditorEmail);
    const role = this.normalizeEmail(user?.role);
    return (
      this.parameters.canManage() ||
      this.parameters.canUseTechnicalDelete(user?.email) ||
      this.parameters.canUseTechnicalDelete(user?.username) ||
      (!!auditor && identities.includes(auditor)) ||
      role === 'admin' ||
      role.includes('auditor')
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.canReview()) return;
    this.error.set('');
    this.success.set('');
    this.loading.set(true);
    this.requestsGateway
      .list()
      .pipe(
        finalize(() => this.loading.set(false)),
        catchError((error) => {
          this.error.set(error?.error?.error || error?.message || 'No fue posible cargar auditoría.');
          return of([]);
        }),
      )
      .subscribe((requests) => this.requests.set(requests));
  }

  approve(request: ManagementDeleteRequest): void {
    if (!request.identifier || this.actionId()) return;
    this.error.set('');
    this.success.set('');
    this.actionId.set(request.id);
    this.management
      .delete(request.identifier)
      .pipe(
        switchMap(() => this.requestsGateway.mark(request.id, 'approved')),
        tap(() => this.success.set('Reporte eliminado y solicitud aprobada.')),
        finalize(() => this.actionId.set('')),
        catchError((error) => {
          this.error.set(
            error?.error?.error ||
              error?.message ||
              'No fue posible eliminar el reporte desde auditoría.',
          );
          return of(null);
        }),
      )
      .subscribe((updated) => {
        if (updated) this.replaceRequest(updated);
      });
  }

  reject(request: ManagementDeleteRequest): void {
    if (!request.id || this.actionId()) return;
    this.error.set('');
    this.success.set('');
    this.actionId.set(request.id);
    this.requestsGateway
      .mark(request.id, 'rejected')
      .pipe(
        tap(() => this.success.set('Solicitud rechazada.')),
        finalize(() => this.actionId.set('')),
        catchError((error) => {
          this.error.set(error?.error?.error || error?.message || 'No fue posible rechazar.');
          return of(null);
        }),
      )
      .subscribe((updated) => {
        if (updated) this.replaceRequest(updated);
      });
  }

  titleFor(request: ManagementDeleteRequest): string {
    const report = request.report;
    return String(
      report.solicitud ||
        report.gestionDemanda ||
        report.solicitud_tiemposConsultores?.nombreGestion ||
        'Reporte sin nombre',
    );
  }

  descriptionFor(request: ManagementDeleteRequest): string {
    return String(request.report.descripcionActividad || request.report.observacion || 'Sin detalle');
  }

  hoursFor(request: ManagementDeleteRequest): string {
    const hours = request.report.tiempoRealHoras;
    return hours === undefined || hours === null || hours === '' ? 'N/A' : `${hours} h`;
  }

  requesterFor(request: ManagementDeleteRequest): string {
    return request.requesterEmail || request.requesterKey || 'Consultor no identificado';
  }

  private replaceRequest(updated: ManagementDeleteRequest): void {
    this.requests.update((requests) =>
      requests.map((request) => (request.id === updated.id ? updated : request)),
    );
  }

  private normalizeEmail(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private dateValue(value: string): number {
    return value ? new Date(value).getTime() || 0 : 0;
  }
}
