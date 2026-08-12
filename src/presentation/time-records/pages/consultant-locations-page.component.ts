import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { ConsultantLocationGateway } from '@application/audit/consultant-location.gateway';
import { AuthGateway } from '@application/auth/auth.gateway';
import {
  ConsultantLocation,
  LocationVerificationStatus,
} from '@domain/audit/consultant-location.model';
import { environment } from '@env/environment';
import { UiPageHeaderComponent } from '@presentation/shared/components/ui-page-header/ui-page-header.component';
import { UiMetricCardComponent } from '@presentation/shared/components/ui-metric-card/ui-metric-card.component';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';

@Component({
  selector: 'app-consultant-locations-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UiPageHeaderComponent,
    UiMetricCardComponent,
    UiSelectComponent,
  ],
  templateUrl: './consultant-locations-page.component.html',
})
export class ConsultantLocationsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('locationMap') private mapElement?: ElementRef<HTMLDivElement>;

  private readonly gateway = inject(ConsultantLocationGateway);
  private readonly auth = inject(AuthGateway);
  private readonly router = inject(Router);
  private map: L.Map | null = null;
  private readonly locationLayers = L.layerGroup();
  private viewReady = false;

  consultants = signal<ConsultantLocation[]>([]);
  loading = signal(false);
  error = signal('');
  selectedConsultant = signal('all');
  authorized = computed(() => {
    const email = String(this.auth.user()?.email || '').trim().toLowerCase();
    return environment.locationAdminEmails.includes(email);
  });

  consultantOptions = computed<readonly UiSelectOption[]>(() => [
    { value: 'all', label: 'Todos los consultores' },
    ...this.consultants().map((consultant) => ({
      value: consultant.userKey,
      label: `${consultant.fullName} · ${consultant.email}`,
    })),
  ]);

  visibleConsultants = computed(() => {
    const selected = this.selectedConsultant();
    return this.consultants().filter(
      (consultant) => selected === 'all' || consultant.userKey === selected,
    );
  });

  locatedConsultants = computed(() =>
    this.visibleConsultants().filter(
      (consultant) => consultant.lastLatitude !== null && consultant.lastLongitude !== null,
    ),
  );

  withinCount = computed(
    () =>
      this.visibleConsultants().filter((consultant) => consultant.lastWithinHomeRadius === true)
        .length,
  );
  outsideCount = computed(
    () =>
      this.visibleConsultants().filter((consultant) => consultant.lastWithinHomeRadius === false)
        .length,
  );
  pendingCount = computed(
    () =>
      this.visibleConsultants().filter((consultant) => consultant.lastWithinHomeRadius === null)
        .length,
  );

  ngOnInit(): void {
    if (!this.authorized()) {
      void this.router.navigateByUrl('/registros/importar', { replaceUrl: true });
      return;
    }
    this.load();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.initializeMap();
    this.renderMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  onConsultantChange(value: string): void {
    this.selectedConsultant.set(value);
    queueMicrotask(() => this.renderMap());
  }

  load(): void {
    if (!this.authorized()) {
      this.consultants.set([]);
      void this.router.navigateByUrl('/registros/importar', { replaceUrl: true });
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.gateway.list({ dateFrom: '2000-01-01', dateTo: this.toDateValue(new Date()) }).subscribe({
      next: (collection) => {
        this.consultants.set(collection.consultants);
        this.loading.set(false);
        queueMicrotask(() => this.renderMap());
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.errorMessage(error));
      },
    });
  }

  verificationLabel(status: LocationVerificationStatus): string {
    const labels: Record<LocationVerificationStatus, string> = {
      within_home_radius: 'Dentro del radio',
      outside_home_radius: 'Fuera del radio',
      reference_auto_created: 'Referencia creada',
      low_accuracy: 'Baja precisión',
      denied: 'Permiso denegado',
      unavailable: 'No disponible',
      timeout: 'Tiempo agotado',
      unsupported: 'No compatible',
    };
    return labels[status] || 'Sin verificar';
  }

  statusClass(consultant: ConsultantLocation): string {
    if (consultant.lastWithinHomeRadius === true)
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (consultant.lastWithinHomeRadius === false)
      return 'border-red-200 bg-red-50 text-red-700';
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  sourceLabel(source: ConsultantLocation['lastLocationSource']): string {
    if (source === 'time_report') return 'Último envío';
    if (source === 'login') return 'Inicio de sesión';
    return 'Sin captura';
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  formatDistance(value: number | null): string {
    if (value === null) return 'Sin cálculo';
    return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${Math.round(value)} m`;
  }

  private initializeMap(): void {
    if (!this.viewReady || !this.mapElement || this.map) return;
    this.map = L.map(this.mapElement.nativeElement, { zoomControl: true }).setView(
      [4.5709, -74.2973],
      5,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.locationLayers.addTo(this.map);
  }

  private renderMap(): void {
    this.initializeMap();
    if (!this.map) return;
    this.locationLayers.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    this.visibleConsultants().forEach((consultant) => {
      if (consultant.homeLatitude === null || consultant.homeLongitude === null) return;
      const homePoint: L.LatLngExpression = [consultant.homeLatitude, consultant.homeLongitude];
      bounds.push(homePoint);
      L.circle(homePoint, {
        radius: consultant.homeRadiusM,
        color: '#2563eb',
        fillColor: '#60a5fa',
        fillOpacity: 0.1,
        weight: 2,
      })
        .bindTooltip(`Radio de referencia · ${consultant.fullName}`)
        .addTo(this.locationLayers);
    });

    this.locatedConsultants().forEach((consultant) => {
      if (consultant.lastLatitude === null || consultant.lastLongitude === null) return;
      const point: L.LatLngExpression = [consultant.lastLatitude, consultant.lastLongitude];
      bounds.push(point);
      const color =
        consultant.lastWithinHomeRadius === true
          ? '#059669'
          : consultant.lastWithinHomeRadius === false
            ? '#dc2626'
            : '#d97706';
      L.circleMarker(point, {
        radius: 10,
        color: '#ffffff',
        fillColor: color,
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip(consultant.fullName, { direction: 'top', offset: [0, -8] })
        .bindPopup(this.popupContent(consultant))
        .addTo(this.locationLayers);
    });

    if (bounds.length)
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [35, 35], maxZoom: 16 });
    else this.map.setView([4.5709, -74.2973], 5);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private popupContent(consultant: ConsultantLocation): HTMLElement {
    const container = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = consultant.fullName;
    const detail = document.createElement('div');
    detail.textContent = `${this.verificationLabel(consultant.lastVerificationStatus || 'unavailable')} · ${this.formatDistance(consultant.lastDistanceToHomeM)}`;
    const date = document.createElement('div');
    date.textContent = consultant.lastLocationAt
      ? `${this.sourceLabel(consultant.lastLocationSource)} · ${this.formatDateTime(consultant.lastLocationAt)}`
      : 'Sin ubicación registrada';
    container.append(title, detail, date);
    return container;
  }

  private errorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') return 'No fue posible consultar las ubicaciones.';
    const response = error as Record<string, unknown>;
    const nested = response['error'];
    if (nested && typeof nested === 'object') {
      const message = (nested as Record<string, unknown>)['error'];
      if (typeof message === 'string') return message;
    }
    return typeof response['message'] === 'string'
      ? response['message']
      : 'No fue posible consultar las ubicaciones.';
  }

  private toDateValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
