import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import { SendLog } from '@domain/time-records/models/send-log.model';
import { UiDateInputComponent } from '@presentation/shared/components/ui-date-input/ui-date-input.component';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';
import { UiMetricCardComponent } from '@presentation/shared/components/ui-metric-card/ui-metric-card.component';
import { UiSearchInputComponent } from '@presentation/shared/components/ui-search-input/ui-search-input.component';
import { UiPageHeaderComponent } from '@presentation/shared/components/ui-page-header/ui-page-header.component';

type LogPeriod = 'week' | '30d' | '90d' | 'custom';
type LogPeriodPreset = Exclude<LogPeriod, 'custom'>;

@Component({
  selector: 'app-send-logs-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UiDateInputComponent,
    UiSelectComponent,
    OverflowTooltipDirective,
    UiMetricCardComponent,
    UiSearchInputComponent,
    UiPageHeaderComponent,
  ],
  templateUrl: './send-logs-page.component.html',
})
export class SendLogsPageComponent implements OnInit {
  private readonly gateway = inject(SendLogGateway);

  logs = signal<SendLog[]>([]);
  loading = signal(false);
  error = signal('');
  isAdmin = signal(false);
  retentionDays = signal(90);
  dateFrom = signal('');
  dateTo = signal('');
  period = signal<LogPeriod>('week');
  status = signal('all');
  scope = signal<'own' | 'all'>('own');
  search = signal('');

  readonly statusOptions: readonly UiSelectOption[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'success', label: 'Enviados correctamente' },
    { value: 'error', label: 'Con error' },
  ];
  readonly scopeOptions: readonly UiSelectOption[] = [
    { value: 'own', label: 'Solo mis registros' },
    { value: 'all', label: 'Todos los consultores' },
  ];
  readonly periodOptions: readonly { key: LogPeriodPreset; label: string }[] = [
    { key: 'week', label: 'Esta semana' },
    { key: '30d', label: '30 días' },
    { key: '90d', label: '90 días' },
  ];

  filteredLogs = computed(() => {
    const term = this.normalize(this.search());
    return this.logs().filter((log) => {
      if (this.status() === 'success' && !log.successful) return false;
      if (this.status() === 'error' && log.successful) return false;
      if (!term) return true;
      return [log.reference, log.errorMessage, log.userEmail].some((value) =>
        this.normalize(value).includes(term),
      );
    });
  });
  successfulCount = computed(() => this.filteredLogs().filter((log) => log.successful).length);
  errorCount = computed(() => this.filteredLogs().filter((log) => !log.successful).length);
  consultantCount = computed(() => new Set(this.filteredLogs().map((log) => log.userEmail)).size);

  ngOnInit(): void {
    this.setPeriod('week');
  }

  setPeriod(period: LogPeriodPreset): void {
    const end = new Date();
    const start = new Date(end);
    if (period === 'week') {
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
    } else {
      start.setDate(start.getDate() - (period === '30d' ? 29 : 89));
    }
    this.dateFrom.set(this.toDateValue(start));
    this.dateTo.set(this.toDateValue(end));
    this.period.set(period);
    this.load();
  }

  onDateChange(target: 'from' | 'to', value: string): void {
    target === 'from' ? this.dateFrom.set(value) : this.dateTo.set(value);
    this.period.set('custom');
  }

  onScopeChange(value: 'own' | 'all'): void {
    this.scope.set(value);
    this.load();
  }

  load(): void {
    if (!this.dateFrom() || !this.dateTo() || this.dateFrom() > this.dateTo()) {
      this.error.set('Selecciona un rango de fechas válido.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.gateway
      .list({ dateFrom: this.dateFrom(), dateTo: this.dateTo(), scope: this.scope() })
      .subscribe({
        next: (collection) => {
          this.logs.set(collection.logs);
          this.isAdmin.set(collection.isAdmin);
          this.retentionDays.set(collection.retentionDays);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(this.errorMessage(error));
        },
      });
  }

  copyVisibleLogs(): void {
    const text = this.filteredLogs()
      .map(
        (log) =>
          `${this.formatDateTime(log.occurredAt)} | ${log.successful ? 'OK' : 'ERROR'} | ${log.userEmail} | ${log.reference}${log.errorMessage ? ` | ${log.errorMessage}` : ''}`,
      )
      .join('\n');
    if (text) navigator.clipboard?.writeText(text);
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private errorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') return 'No fue posible consultar los logs.';
    const response = error as Record<string, unknown>;
    const nested = response['error'];
    if (nested && typeof nested === 'object') {
      const message = (nested as Record<string, unknown>)['error'];
      if (typeof message === 'string') return message;
    }
    return typeof response['message'] === 'string'
      ? response['message']
      : 'No fue posible consultar los logs.';
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private toDateValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
